// TODO: cleanup unused exported functions
import { browser } from "wxt/browser";
import { getDomainFromUrl } from "@/entrypoints/background/utils";
import { db } from "@/lib/db/db";
import { getRandomTabGroupColor } from "@/lib/helpers/tab-helpers";

export async function sortTabsInWindow(
  windowId: number,
  sortType: "title" | "domain" | "recency",
) {
  try {
    // Get all tabs in the specified window
    const tabs = await browser.tabs.query({ windowId });

    // Filter out dashboard tabs
    const nonDashboardTabs = tabs.filter((tab) => {
      const ourExtensionBaseURL = browser.runtime.getURL("");
      const specificDashboardURL = browser.runtime.getURL("/dashboard.html");
      return (
        tab.url !== specificDashboardURL &&
        !tab.url?.startsWith(ourExtensionBaseURL)
      );
    });

    if (nonDashboardTabs.length <= 1) return; // Nothing to sort

    // Keep pinned tabs at the top and stable relative to each other
    const pinned = nonDashboardTabs.filter((t) => t.pinned);
    const unpinned = nonDashboardTabs.filter((t) => !t.pinned);

    const sortCore = (a: Browser.tabs.Tab, b: Browser.tabs.Tab) => {
      switch (sortType) {
        case "title":
          return (a.title || "").localeCompare(b.title || "");
        case "domain": {
          const domainA = getDomainFromUrl(a.url || "");
          const domainB = getDomainFromUrl(b.url || "");
          return domainA.localeCompare(domainB);
        }
        case "recency":
          // For recency, we need to get creation time from the database
          // Since we don't have direct access to creation time in browser tabs,
          // we'll sort by index for now (assuming newer tabs have higher indices)
          return (b.index || 0) - (a.index || 0);
        default:
          return 0;
      }
    };

    const sortedTabs = [
      ...pinned, // keep original order for pinned
      ...[...unpinned].sort(sortCore),
    ];

    // Update the index of each tab to reflect the new order
    for (let i = 0; i < sortedTabs.length; i++) {
      const tab = sortedTabs[i];
      if (tab.id !== undefined) {
        await browser.tabs.move(tab.id, { index: i });
      }
    }

    console.log(
      `✅ Sorted ${sortedTabs.length} tabs in window ${windowId} by ${sortType}`,
    );
  } catch (error) {
    console.error(`❌ Failed to sort tabs in window ${windowId}:`, error);
    throw error;
  }
}

export async function groupTabsInWindow(
  windowId: number,
  _groupType: "domain",
) {
  try {
    // Get all tabs in the specified window
    const tabs = await browser.tabs.query({ windowId });

    // Filter out dashboard tabs
    const nonDashboardTabs = tabs.filter((tab) => {
      const ourExtensionBaseURL = browser.runtime.getURL("");
      const specificDashboardURL = browser.runtime.getURL("/dashboard.html");
      return (
        tab.url !== specificDashboardURL &&
        !tab.url?.startsWith(ourExtensionBaseURL)
      );
    });

    if (nonDashboardTabs.length <= 1) return; // Nothing to group

    // Group tabs by domain
    const tabsByDomain = new Map<string, typeof nonDashboardTabs>();

    for (const tab of nonDashboardTabs) {
      const domain = getDomainFromUrl(tab.url || "");
      if (!tabsByDomain.has(domain)) {
        tabsByDomain.set(domain, []);
      }
      tabsByDomain.get(domain)?.push(tab);
    }

    // Find domains with 3 or more tabs
    const domainsToGroup = Array.from(tabsByDomain.entries()).filter(
      ([_, tabs]) => tabs.length >= 3,
    );

    // Create groups for domains with 3+ tabs
    for (const [domain, domainTabs] of domainsToGroup) {
      if (domainTabs.length < 3) continue;

      try {
        // Get tab IDs for grouping
        const tabIds = domainTabs
          .map((tab) => tab.id)
          .filter((id): id is number => id !== undefined) as [
          number,
          ...number[],
        ];

        if (tabIds.length >= 2) {
          // browser.tabs.group requires at least 2 tabs
          // Create the group
          const groupId = await browser.tabs.group({
            tabIds,
            createProperties: { windowId },
          });

          // Update the group with a title based on the domain
          await browser.tabGroups.update(groupId, {
            title: domain,
            color: getRandomTabGroupColor(),
          });

          console.log(
            `✅ Created group "${domain}" with ${tabIds.length} tabs in window ${windowId}`,
          );
        }
      } catch (groupError) {
        console.error(
          `❌ Failed to create group for domain "${domain}":`,
          groupError,
        );
      }
    }

    const groupedCount = domainsToGroup.reduce(
      (sum, [_, tabs]) => sum + tabs.length,
      0,
    );
    console.log(
      `✅ Grouped ${groupedCount} tabs into ${domainsToGroup.length} domain groups in window ${windowId}`,
    );
  } catch (error) {
    console.error(`❌ Failed to group tabs in window ${windowId}:`, error);
    throw error;
  }
}

export async function sortTabsInWorkspace(
  workspaceId: number,
  sortType: "title" | "domain" | "recency",
) {
  try {
    // Ungroup tabs first to ensure clean sorting
    await ungroupTabsInWorkspace(workspaceId);

    // Get all tabs in the workspace
    const tabs = await db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .toArray();
    // Get unique windowIds
    const windowIds = [...new Set(tabs.map((tab) => tab.windowId))];
    // Sort tabs in each window
    for (const windowId of windowIds) {
      await sortTabsInWindow(windowId, sortType);
    }
    console.log(`✅ Sorted tabs in workspace ${workspaceId} by ${sortType}`);
  } catch (error) {
    console.error(`❌ Failed to sort tabs in workspace ${workspaceId}:`, error);
    throw error;
  }
}

export async function groupTabsInWorkspace(
  workspaceId: number,
  groupType: "domain",
) {
  try {
    // Ungroup tabs first to ensure clean grouping
    await ungroupTabsInWorkspace(workspaceId);

    // Get all tabs in the workspace
    const tabs = await db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .toArray();
    // Get unique windowIds
    const windowIds = [...new Set(tabs.map((tab) => tab.windowId))];
    // Group tabs in each window
    for (const windowId of windowIds) {
      await groupTabsInWindow(windowId, groupType);
    }
    console.log(`✅ Grouped tabs in workspace ${workspaceId} by ${groupType}`);
  } catch (error) {
    console.error(
      `❌ Failed to group tabs in workspace ${workspaceId}:`,
      error,
    );
    throw error;
  }
}

export async function ungroupTabsInWorkspace(workspaceId: number) {
  try {
    // Get all tabs in the workspace
    const tabs = await db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .toArray();
    // Get unique windowIds
    const windowIds = [...new Set(tabs.map((tab) => tab.windowId))];

    // Ungroup tabs in each window
    for (const windowId of windowIds) {
      await ungroupTabsInWindow(windowId);
    }
    console.log(`✅ Ungrouped tabs in workspace ${workspaceId}`);
  } catch (error) {
    console.error(
      `❌ Failed to ungroup tabs in workspace ${workspaceId}:`,
      error,
    );
    throw error;
  }
}

export async function ungroupTabsInWindow(windowId: number) {
  try {
    // Get all tabs in the window that belong to groups
    const allTabs = await browser.tabs.query({ windowId });
    const groupedTabIds: number[] = [];

    for (const tab of allTabs) {
      if (
        tab.id !== undefined &&
        tab.groupId !== undefined &&
        tab.groupId !== -1
      ) {
        groupedTabIds.push(tab.id);
      }
    }

    if (groupedTabIds.length > 0) {
      try {
        // Ungroup the tabs using Chrome API
        // wxt/browser types: Chrome supports tabs.ungroup
        const anyTabs = browser.tabs as unknown as {
          ungroup?: (tabIds: number[]) => Promise<void>;
        };
        if (anyTabs.ungroup) {
          await anyTabs.ungroup(groupedTabIds);
          console.log(
            `✅ Ungrouped ${groupedTabIds.length} tabs in window ${windowId}`,
          );
        }
      } catch (ungroupError) {
        console.error(
          `❌ Failed to ungroup tabs in window ${windowId}:`,
          ungroupError,
        );
      }
    } else {
      console.log(`i No grouped tabs found in window ${windowId}`);
    }
  } catch (error) {
    console.error(`❌ Failed to ungroup tabs in window ${windowId}:`, error);
    throw error;
  }
}
