import { liveQuery } from "dexie";
import { browser } from "wxt/browser";
import {
  reconcileTabs,
  refreshActiveTabs,
  switchWorkspaceTabs,
} from "@/entrypoints/background/helpers";
import {
  createWorkspaceSnapshot,
  deleteSnapshot,
  restoreSnapshot,
  startSnapshotScheduler,
} from "@/entrypoints/background/snapshots";
import {
  setupTabListeners,
  validateAllTabs,
} from "@/entrypoints/background/tab-listeners";
import {
  setupTabGroupListeners,
  syncAllTabGroups,
} from "@/entrypoints/background/tabGroup-listeners";
import {
  getDomainFromUrl,
  isDashboardTab,
} from "@/entrypoints/background/utils";
import { db } from "@/lib/db/db";
import { getRandomTabGroupColor } from "@/lib/helpers/tab-helpers";
import type { RuntimeMessage, Workspace } from "@/lib/types/types";

export default defineBackground(() => {
  let activeWorkspace: Workspace | undefined;
  // TODO: maybe we can have some live query objects here that will be in memory and even if service worker dies, when they respawn they will still have latest state,
  // So then we dont have to repeat similar transactions on service worker
  // TODO: make it so that if there is an active workspace, open the tabs accordingly
  // TODO: stop having so many db queries and operations, lets modualrize them, suing db.transactions and also reusing variables across functions so we dont
  // have the same db across different sections when we are getting the same data
  (async () => {
    try {
      const dashboardPageURL = browser.runtime.getURL("/dashboard.html");

      // Query all tabs to see if our dashboard is already open
      const allTabs = await browser.tabs.query({});

      // Check if any tab matches our specific dashboard URL
      const dashboardTabExists = allTabs.some(
        (tab) => tab.url === dashboardPageURL,
      );

      if (!dashboardTabExists) {
        await browser.tabs.create({
          url: dashboardPageURL,
          pinned: true,
          active: true,
          index: 0,
        });
      }
    } catch (err) {
      console.error("Error ensuring dashboard tab:", err);
      if (browser?.runtime?.lastError) {
        console.error("Browser last error:", browser.runtime.lastError.message);
      }
    }
  })();

  const aw = liveQuery(() => db.workspaces.where("active").equals(1).first());
  aw.subscribe({
    next: (result) => {
      activeWorkspace = result;
    },
    error: (error) => console.error(error),
  });

  // Start background snapshot scheduler (checks every minute, snapshots at min interval)
  try {
    startSnapshotScheduler(() => activeWorkspace);
  } catch (e) {
    console.error(e);
  }

  //
  // Tabs
  //
  refreshActiveTabs();

  // Setup tab listeners
  setupTabListeners(() => activeWorkspace);

  //
  // Tab Groups
  //
  // Initial sync of all existing tab groups on startup
  syncAllTabGroups(() => activeWorkspace);

  // Setup tab group listeners
  setupTabGroupListeners(() => activeWorkspace);

  //
  // Periodic operations
  //

  // Periodic reconciliation to ensure tab state stays fresh (every 2 minutes)
  setInterval(
    () => {
      reconcileTabs().catch((err) => {
        console.error("Periodic reconciliation failed:", err);
      });
    },
    10 * 60 * 1000,
  ); // 10 minutes

  // Periodic tab validation to ensure windowId and other properties stay in sync (every 30 seconds)
  setInterval(
    () => {
      validateAllTabs().catch((err) => {
        console.error("Periodic tab validation failed:", err);
      });
    },
    10 * 60 * 1000,
  ); // 10 minutes

  // Periodic tab group sync to ensure group state stays fresh (every minute)
  setInterval(
    () => {
      syncAllTabGroups(() => activeWorkspace).catch((err) => {
        console.error("Periodic tab group sync failed:", err);
      });
    },
    10 * 60 * 1000,
  ); // 10 minutes

  async function sortTabsInWindow(
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

      // Sort the tabs based on the specified criteria
      const sortedTabs = [...nonDashboardTabs].sort((a, b) => {
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
      });

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

  async function groupTabsInWindow(windowId: number, _groupType: "domain") {
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

  async function sortTabsInWorkspace(
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
      console.error(
        `❌ Failed to sort tabs in workspace ${workspaceId}:`,
        error,
      );
      throw error;
    }
  }

  async function groupTabsInWorkspace(
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
      console.log(
        `✅ Grouped tabs in workspace ${workspaceId} by ${groupType}`,
      );
    } catch (error) {
      console.error(
        `❌ Failed to group tabs in workspace ${workspaceId}:`,
        error,
      );
      throw error;
    }
  }

  async function ungroupTabsInWorkspace(workspaceId: number) {
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

  async function ungroupTabsInWindow(windowId: number) {
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
          const tabsApi = browser.tabs as unknown as {
            ungroup?: (tabIds: number[]) => Promise<void>;
          };
          if (tabsApi.ungroup) {
            await tabsApi.ungroup(groupedTabIds);
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

  async function cleanUnusedTabsInWorkspace(
    workspaceId: number,
    daysThreshold: number = 3,
  ) {
    try {
      console.log(
        `🧹 Cleaning unused tabs in workspace ${workspaceId} (older than ${daysThreshold} days)`,
      );

      // Get all tabs in the workspace
      const tabs = await db.activeTabs
        .where("workspaceId")
        .equals(workspaceId)
        .toArray();

      // Calculate the cutoff date (3 days ago from now)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);
      const cutoffTime = cutoffDate.getTime();

      // Filter tabs that haven't been accessed recently
      // Use updatedAt as a fallback since lastAccessed might not be available
      const unusedTabs = tabs.filter((tab) => {
        const lastActivityTime = tab.updatedAt || tab.createdAt;
        return lastActivityTime < cutoffTime;
      });

      if (unusedTabs.length === 0) {
        console.log(`i No unused tabs found in workspace ${workspaceId}`);
        return;
      }

      // Close the unused browser tabs and archive them in database
      const tabIdsToClose = unusedTabs
        .map((tab) => tab.id)
        .filter((id): id is number => id !== undefined);

      if (tabIdsToClose.length > 0) {
        try {
          // Verify tabs exist before trying to close them
          const existingTabs = await browser.tabs.query({});
          const existingTabIds = new Set(
            existingTabs
              .map((t) => t.id)
              .filter((id): id is number => id !== undefined),
          );
          const validTabIdsToClose = tabIdsToClose.filter((id) =>
            existingTabIds.has(id),
          );

          // Close browser tabs that still exist
          if (validTabIdsToClose.length > 0) {
            await browser.tabs.remove(validTabIdsToClose);
          }

          // Archive all unused tabs in database (regardless of whether browser tab existed)
          const stableIdsToArchive = unusedTabs.map((tab) => tab.stableId);
          await db.activeTabs
            .where("stableId")
            .anyOf(stableIdsToArchive)
            .modify({ tabStatus: "archived" });

          console.log(
            `✅ Cleaned ${unusedTabs.length} unused tabs from workspace ${workspaceId}`,
          );
        } catch (error) {
          console.error(`❌ Error cleaning unused tabs:`, error);
        }
      }
    } catch (error) {
      console.error(
        `❌ Failed to clean unused tabs in workspace ${workspaceId}:`,
        error,
      );
      throw error;
    }
  }

  async function cleanDuplicateTabsInWorkspace(workspaceId: number) {
    try {
      // Get only active tabs in the workspace (exclude already archived tabs)
      const tabs = await db.activeTabs
        .where("workspaceId")
        .equals(workspaceId)
        .and((tab) => tab.tabStatus === "active")
        .toArray();

      // Group tabs by URL to find duplicates
      const tabsByUrl = new Map<string, typeof tabs>();

      for (const tab of tabs) {
        if (!tab.url) continue;

        if (!tabsByUrl.has(tab.url)) {
          tabsByUrl.set(tab.url, []);
        }
        tabsByUrl.get(tab.url)?.push(tab);
      }

      // Find URLs with multiple tabs (duplicates)
      const duplicateGroups = Array.from(tabsByUrl.entries()).filter(
        ([_, tabs]) => tabs.length > 1,
      );

      if (duplicateGroups.length === 0) {
        return;
      }

      let totalCleaned = 0;

      // For each duplicate group, keep the most recently updated tab and close the rest
      for (const [_url, duplicateTabs] of duplicateGroups) {
        // Sort by updatedAt (most recent first), fallback to id if no updatedAt
        const sortedTabs = [...duplicateTabs].sort((a, b) => {
          const aTime = a.updatedAt || a.createdAt;
          const bTime = b.updatedAt || b.createdAt;
          return bTime - aTime;
        });

        // Keep the first (most recent) tab, close the rest
        const tabsToClose = sortedTabs.slice(1);

        // Close browser tabs that still exist
        const tabIdsToClose = tabsToClose
          .map((tab) => tab.id)
          .filter((id): id is number => id !== undefined);

        if (tabIdsToClose.length > 0) {
          try {
            const existingTabs = await browser.tabs.query({});
            const existingTabIds = new Set(
              existingTabs
                .map((t) => t.id)
                .filter((id): id is number => id !== undefined),
            );
            const validTabIdsToClose = tabIdsToClose.filter((id) =>
              existingTabIds.has(id),
            );

            if (validTabIdsToClose.length > 0) {
              await browser.tabs.remove(validTabIdsToClose);
            }
          } catch (error) {
            console.error(`❌ Error closing duplicate tabs:`, error);
          }
        }

        // Archive all duplicate tabs in database
        const stableIdsToArchive = tabsToClose.map((tab) => tab.stableId);
        if (stableIdsToArchive.length > 0) {
          await db.activeTabs
            .where("stableId")
            .anyOf(stableIdsToArchive)
            .modify({ tabStatus: "archived" });
          totalCleaned += stableIdsToArchive.length;
        }
      }

      if (totalCleaned > 0) {
        console.log(
          `✅ Cleaned ${totalCleaned} duplicate tabs from workspace ${workspaceId}`,
        );
      }
    } catch (error) {
      console.error(
        `❌ Failed to clean duplicate tabs in workspace ${workspaceId}:`,
        error,
      );
      throw error;
    }
  }

  async function cleanResourceTabsInWorkspace(workspaceId: number) {
    try {
      // Get only active tabs in the workspace
      const tabs = await db.activeTabs
        .where("workspaceId")
        .equals(workspaceId)
        .and((tab) => tab.tabStatus === "active")
        .toArray();

      // Get all resources globally
      const resources = await db.resources.toArray();
      if (resources.length === 0) {
        return;
      }

      // Create a set of resource URLs for quick lookup
      const resourceUrls = new Set(
        resources
          .map((resource) => resource.url)
          .filter((url): url is string => url !== undefined),
      );

      // Find tabs that match resource URLs (excluding dashboard tabs)
      const resourceTabs = tabs.filter(
        (tab) => tab.url && resourceUrls.has(tab.url) && !isDashboardTab(tab),
      );

      if (resourceTabs.length === 0) {
        return;
      }

      // Close browser tabs that still exist
      const tabIdsToClose = resourceTabs
        .map((tab) => tab.id)
        .filter((id): id is number => id !== undefined);

      if (tabIdsToClose.length > 0) {
        try {
          const existingTabs = await browser.tabs.query({});
          const existingTabIds = new Set(
            existingTabs
              .map((t) => t.id)
              .filter((id): id is number => id !== undefined),
          );
          const validTabIdsToClose = tabIdsToClose.filter((id) =>
            existingTabIds.has(id),
          );

          if (validTabIdsToClose.length > 0) {
            await browser.tabs.remove(validTabIdsToClose);
          }
        } catch (error) {
          console.error(`❌ Error closing resource tabs:`, error);
        }
      }

      // Archive all resource tabs in database
      const stableIdsToArchive = resourceTabs.map((tab) => tab.stableId);
      if (stableIdsToArchive.length > 0) {
        await db.activeTabs
          .where("stableId")
          .anyOf(stableIdsToArchive)
          .modify({ tabStatus: "archived" });

        console.log(
          `✅ Cleaned ${resourceTabs.length} resource tabs from workspace ${workspaceId}`,
        );
      }
    } catch (error) {
      console.error(
        `❌ Failed to clean resource tabs in workspace ${workspaceId}:`,
        error,
      );
      throw error;
    }
  }

  async function cleanNonResourceTabsInWorkspace(workspaceId: number) {
    try {
      // Get only active tabs in the workspace
      const tabs = await db.activeTabs
        .where("workspaceId")
        .equals(workspaceId)
        .and((tab) => tab.tabStatus === "active")
        .toArray();

      // Get all resources globally
      const resources = await db.resources.toArray();

      // Create a set of resource URLs for quick lookup
      const resourceUrls = new Set(
        resources
          .map((resource) => resource.url)
          .filter((url): url is string => url !== undefined),
      );

      // Find tabs that DON'T match resource URLs (excluding dashboard tabs)
      const nonResourceTabs = tabs.filter(
        (tab) =>
          (!tab.url || !resourceUrls.has(tab.url)) && !isDashboardTab(tab),
      );

      if (nonResourceTabs.length === 0) {
        return;
      }

      // Close browser tabs that still exist
      const tabIdsToClose = nonResourceTabs
        .map((tab) => tab.id)
        .filter((id): id is number => id !== undefined);

      if (tabIdsToClose.length > 0) {
        try {
          const existingTabs = await browser.tabs.query({});
          const existingTabIds = new Set(
            existingTabs
              .map((t) => t.id)
              .filter((id): id is number => id !== undefined),
          );
          const validTabIdsToClose = tabIdsToClose.filter((id) =>
            existingTabIds.has(id),
          );

          if (validTabIdsToClose.length > 0) {
            await browser.tabs.remove(validTabIdsToClose);
          }
        } catch (error) {
          console.error(`❌ Error closing non-resource tabs:`, error);
        }
      }

      // Archive all non-resource tabs in database
      const stableIdsToArchive = nonResourceTabs.map((tab) => tab.stableId);
      if (stableIdsToArchive.length > 0) {
        await db.activeTabs
          .where("stableId")
          .anyOf(stableIdsToArchive)
          .modify({ tabStatus: "archived" });

        console.log(
          `✅ Cleaned ${nonResourceTabs.length} non-resource tabs from workspace ${workspaceId}`,
        );
      }
    } catch (error) {
      console.error(
        `❌ Failed to clean non-resource tabs in workspace ${workspaceId}:`,
        error,
      );
      throw error;
    }
  }

  async function convertTabGroupToResource(groupId: number) {
    try {
      console.log(`Converting tab group ${groupId} to resource`);

      // Get the tab group
      const tabGroup = await db.tabGroups.get(groupId);
      if (!tabGroup) {
        throw new Error(`Tab group with ID ${groupId} not found`);
      }

      // Get all tabs in this group
      const tabsInGroup = await db.activeTabs
        .where("groupId")
        .equals(groupId)
        .toArray();

      if (tabsInGroup.length === 0) {
        throw new Error(`No tabs found in group ${groupId}`);
      }

      // Get the workspace this group belongs to
      const workspace = await db.workspaces.get(tabGroup.workspaceId);
      if (!workspace) {
        throw new Error(`Workspace with ID ${tabGroup.workspaceId} not found`);
      }

      // Create a resource group
      const timestamp = Date.now();
      const resourceGroupId = (await db.resourceGroups.count()) + 1;
      const resourceGroup = {
        id: resourceGroupId,
        name: tabGroup.title || "Converted Tab Group",
        collapsed: 0 as const,
        resourceIds: [] as string[],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await db.resourceGroups.add(resourceGroup);

      // Create resources from tabs
      const resourceIds: string[] = [];
      for (const tab of tabsInGroup) {
        if (!tab.url) continue;

        const resource = {
          id: (await db.resources.count()) + 1,
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl,
          tags: tab.tags,
          description: tab.description,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        await db.resources.add(resource);
        resourceIds.push(resource.id.toString());
      }

      // Update resource group with resource IDs
      await db.resourceGroups.update(resourceGroupId, {
        resourceIds,
        updatedAt: timestamp,
      });

      // Add resource group to workspace
      const updatedResourceGroupIds = [
        ...(workspace.resourceGroupIds || []),
        resourceGroupId,
      ];
      await db.workspaces.update(workspace.id, {
        resourceGroupIds: updatedResourceGroupIds,
      });

      // Close browser tabs that still exist
      const tabIdsToClose = tabsInGroup
        .map((tab) => tab.id)
        .filter((id): id is number => id !== undefined);

      if (tabIdsToClose.length > 0) {
        try {
          const existingTabs = await browser.tabs.query({});
          const existingTabIds = new Set(
            existingTabs
              .map((t) => t.id)
              .filter((id): id is number => id !== undefined),
          );
          const validTabIdsToClose = tabIdsToClose.filter((id) =>
            existingTabIds.has(id),
          );

          if (validTabIdsToClose.length > 0) {
            await browser.tabs.remove(validTabIdsToClose);
          }
        } catch (error) {
          console.error(`❌ Error closing tabs in group:`, error);
        }
      }

      // Archive all tabs in the database
      const stableIdsToArchive = tabsInGroup.map((tab) => tab.stableId);
      await db.activeTabs
        .where("stableId")
        .anyOf(stableIdsToArchive)
        .modify({ tabStatus: "archived" });

      // Archive the tab group
      await db.tabGroups.update(groupId, {
        groupStatus: "archived",
        updatedAt: timestamp,
      });

      console.log(
        `✅ Converted tab group ${groupId} to resource group ${resourceGroupId} with ${resourceIds.length} resources`,
      );
    } catch (error) {
      console.error(
        `❌ Failed to convert tab group ${groupId} to resource:`,
        error,
      );
      throw error;
    }
  }

  // Handle extension icon click
  async function handleActionClick() {
    try {
      const dashboardPageURL = browser.runtime.getURL("/dashboard.html");

      // Query all tabs to see if our dashboard is already open
      const allTabs = await browser.tabs.query({});

      // Check if any tab matches our specific dashboard URL
      const dashboardTab = allTabs.find((tab) => tab.url === dashboardPageURL);

      if (dashboardTab?.id) {
        // Dashboard tab exists, focus it
        await browser.tabs.update(dashboardTab.id, { active: true });
        await browser.windows.update(dashboardTab.windowId, { focused: true });
        console.log("Focused existing dashboard tab");
      } else {
        // Dashboard tab doesn't exist, create it
        await browser.tabs.create({
          url: dashboardPageURL,
          pinned: true,
          active: true,
          index: 0,
        });
        console.log("Created new dashboard tab");
      }
    } catch (err) {
      console.error("Error handling action click:", err);
      if (browser?.runtime?.lastError) {
        console.error("Browser last error:", browser.runtime.lastError.message);
      }
    }
  }

  //
  // Messages
  //
  // Handle extension icon click
  browser.action.onClicked.addListener((_tab) => {
    handleActionClick().catch((err) => {
      console.error("Failed to handle action click:", err);
    });
  });

  // Handle keyboard commands
  browser.commands.onCommand.addListener(async (command) => {
    if (command === "open-command-menu") {
      try {
        // First ensure dashboard is open/focused
        await handleActionClick();

        // Then send message to dashboard to open command menu
        const dashboardPageURL = browser.runtime.getURL("/dashboard.html");
        const dashboardTabs = await browser.tabs.query({
          url: dashboardPageURL,
        });

        if (dashboardTabs.length > 0 && dashboardTabs[0].id) {
          await browser.tabs.sendMessage(dashboardTabs[0].id, {
            type: "openCommandMenu",
          });
        }
      } catch (err) {
        console.error("Failed to handle command menu:", err);
      }
    }
  });

  // Maybe this could be done on dashboard? without relying on service worker? idk if that would be better or more reliable
  // TODO: Make one big ops for db for atomic updates
  // TODO: modularize this code, maybe have a separate file for this
  // NOTE: on the logs, this updatetabgroup is getting logged on application console, not service worker, so this message comm doesnt even need to be necessary then
  browser.runtime.onMessage.addListener(
    async (message: RuntimeMessage, _sender) => {
      // Internal helper to activate a workspace and optionally skip restoring from DB
      async function activateWorkspace(
        workspaceId: number,
        opts?: { skipTabSwitching?: boolean },
      ) {
        // Get the current active workspace before switching
        const currentActiveWorkspace = await db.workspaces
          .where("active")
          .equals(1)
          .first();

        const isConvertingFromUndefined =
          !currentActiveWorkspace && opts?.skipTabSwitching === true;

        // Archive all tabs from the current active workspace (only if there is one)
        if (currentActiveWorkspace) {
          // Remove any previous archived snapshot for this workspace to avoid accumulating duplicates
          await db.activeTabs
            .where("workspaceId")
            .equals(currentActiveWorkspace.id)
            .and((t) => t.tabStatus === "archived")
            .delete();

          await db.activeTabs
            .where("workspaceId")
            .equals(currentActiveWorkspace.id)
            .and((t) => t.tabStatus === "active")
            .modify({ tabStatus: "archived" });
        }

        // make active workspace the new workspace
        await db.workspaces.where("id").equals(workspaceId).modify({
          active: 1,
          lastOpened: Date.now(),
        });

        // make all other workspaces inactive
        await db.workspaces.where("id").notEqual(workspaceId).modify({
          active: 0,
        });

        if (isConvertingFromUndefined) {
          // For undefined workspace conversion, just refresh to ensure fresh state
          // without closing and reopening tabs
          await reconcileTabs();
          return;
        } else if (opts?.skipTabSwitching) {
          // Close all non-dashboard tabs, keep dashboard focused
          const allCurrentBrowserTabs = await browser.tabs.query({});
          const nonDashboardTabIdsToClose: number[] = [];
          for (const tab of allCurrentBrowserTabs) {
            if (tab.id != null && !isDashboardTab(tab)) {
              nonDashboardTabIdsToClose.push(tab.id);
            }
          }
          if (nonDashboardTabIdsToClose.length > 0) {
            await browser.tabs.remove(nonDashboardTabIdsToClose);
          }
          return;
        }

        // Normal workspace switching: close current tabs and open workspace tabs from DB
        await switchWorkspaceTabs(workspaceId);
      }

      // Internal helper to create a workspace and open a list of URLs in it
      async function createWorkspaceFromUrls(
        name: string,
        urls: string[],
      ): Promise<{ success: boolean; workspaceId?: number; error?: string }> {
        try {
          const validUrls = Array.from(
            new Set(
              (urls || []).filter((u): u is string => {
                if (!u) return false;
                try {
                  const parsed = new URL(u);
                  return Boolean(parsed.protocol && parsed.hostname);
                } catch {
                  return false;
                }
              }),
            ),
          );

          if (validUrls.length === 0) {
            return { success: false, error: "No valid URLs" } as const;
          }

          const now = Date.now();

          // Create the new workspace (inactive initially)
          const newWorkspaceId = await db.workspaces.add({
            name: name || "New Workspace",
            createdAt: now,
            lastOpened: now,
            active: 0,
            resourceGroupIds: [],
          } as Omit<Workspace, "id">);

          // Activate new workspace and close non-dashboard tabs without restoring from DB
          await activateWorkspace(newWorkspaceId, { skipTabSwitching: true });

          // Find a target window (prefer dashboard window)
          const allCurrentBrowserTabs = await browser.tabs.query({});
          let dashboardWindowId: number | undefined;
          for (const tab of allCurrentBrowserTabs) {
            if (tab.id != null && isDashboardTab(tab) && tab.windowId != null) {
              dashboardWindowId = tab.windowId;
              break;
            }
          }
          if (!dashboardWindowId) {
            const win = await browser.windows.create({ focused: true });
            if (win && win.id != null) dashboardWindowId = win.id;
          }

          // Open the URLs as background tabs in the target window
          for (const url of validUrls) {
            await browser.tabs.create({
              url,
              windowId: dashboardWindowId,
              active: false,
            });
          }

          return { success: true, workspaceId: newWorkspaceId } as const;
        } catch (error) {
          console.error("Failed to create workspace from URLs:", error);
          return { success: false, error: String(error) } as const;
        }
      }
      if (typeof message === "object" && message.type === "updateTabGroup") {
        console.log("Updating tab group", message.groupId, "with", {
          title: message.title,
          color: message.color,
        });

        try {
          // Update the browser tab group using the background script's permissions
          await browser.tabGroups.update(message.groupId, {
            title: message.title,

            color: message.color as Browser.tabGroups.Color,
          });
          return { success: true };
        } catch (error) {
          console.error("❌ Failed to update tab group:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      } else if (
        typeof message === "object" &&
        message.type === "toggleGroupCollapse"
      ) {
        console.log("Toggling group collapse", message.groupId);

        try {
          // Get the current group state
          const group = await browser.tabGroups.get(message.groupId);
          await browser.tabGroups.update(message.groupId, {
            collapsed: !group.collapsed,
          });
          return { success: true };
        } catch (error) {
          console.error("❌ Failed to toggle group collapse:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      } else if (
        typeof message === "object" &&
        message.type === "openWorkspace"
      ) {
        console.log("Opening workspace", message.workspaceId);
        try {
          await activateWorkspace(message.workspaceId, {
            skipTabSwitching: message.skipTabSwitching === true,
          });
          return { success: true } as const;
        } catch (error) {
          console.error("Failed to open workspace:", error);
          return { success: false, error: String(error) } as const;
        }
      } else if (
        typeof message === "object" &&
        message.type === "closeWorkspace"
      ) {
        console.log("Closing workspace");

        // Get the current active workspace
        const currentActiveWorkspace = await db.workspaces
          .where("active")
          .equals(1)
          .first();

        if (currentActiveWorkspace) {
          // Archive all tabs from the current active workspace
          await db.activeTabs
            .where("workspaceId")
            .equals(currentActiveWorkspace.id)
            .modify({ tabStatus: "archived" });

          // Deactivate the current workspace
          await db.workspaces
            .where("id")
            .equals(currentActiveWorkspace.id)
            .modify({ active: 0 });

          // Close all non-dashboard tabs
          const allCurrentBrowserTabs = await browser.tabs.query({});
          const nonDashboardTabIdsToClose: number[] = [];

          for (const tab of allCurrentBrowserTabs) {
            if (tab.id != null && !isDashboardTab(tab)) {
              nonDashboardTabIdsToClose.push(tab.id);
            }
          }

          if (nonDashboardTabIdsToClose.length > 0) {
            await browser.tabs.remove(nonDashboardTabIdsToClose);
          }
        }
      } else if (
        typeof message === "object" &&
        message.type === "createSnapshot"
      ) {
        const ws = message.workspaceId ?? activeWorkspace?.id;
        if (!ws) return { success: false, error: "No workspace" } as const;
        const id = await createWorkspaceSnapshot(
          ws,
          message.reason ?? "manual",
        );
        return { success: id > 0, snapshotId: id } as const;
      } else if (
        typeof message === "object" &&
        message.type === "restoreSnapshot"
      ) {
        const res = await restoreSnapshot(
          message.snapshotId,
          message.mode ?? "replace",
        );
        return res;
      } else if (
        typeof message === "object" &&
        message.type === "deleteSnapshot"
      ) {
        await deleteSnapshot(message.snapshotId);
        return { success: true } as const;
      } else if (
        typeof message === "object" &&
        message.type === "refreshTabs"
      ) {
        try {
          await reconcileTabs();
          return { success: true } as const;
        } catch (err) {
          console.error("Reconciliation failed:", err);
          return { success: false, error: String(err) } as const;
        }
      } else if (typeof message === "object" && message.type === "sortTabs") {
        await sortTabsInWorkspace(message.workspaceId, message.sortType);
        return { success: true } as const;
      } else if (typeof message === "object" && message.type === "groupTabs") {
        await groupTabsInWorkspace(message.workspaceId, message.groupType);
        return { success: true } as const;
      } else if (
        typeof message === "object" &&
        message.type === "ungroupTabs"
      ) {
        await ungroupTabsInWorkspace(message.workspaceId);
        return { success: true } as const;
      } else if (typeof message === "object" && message.type === "moveTab") {
        console.log("Moving tab", message.tabId, "to index", message.newIndex);
        try {
          await browser.tabs.move(message.tabId, { index: message.newIndex });
          return { success: true } as const;
        } catch (error) {
          console.error("❌ Failed to move tab:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          } as const;
        }
      } else if (
        typeof message === "object" &&
        message.type === "cleanUnusedTabs"
      ) {
        await cleanUnusedTabsInWorkspace(
          message.workspaceId,
          message.daysThreshold,
        );
        return { success: true } as const;
      } else if (
        typeof message === "object" &&
        message.type === "cleanDuplicateTabs"
      ) {
        await cleanDuplicateTabsInWorkspace(message.workspaceId);
        return { success: true } as const;
      } else if (
        typeof message === "object" &&
        message.type === "cleanResourceTabs"
      ) {
        await cleanResourceTabsInWorkspace(message.workspaceId);
        return { success: true } as const;
      } else if (
        typeof message === "object" &&
        message.type === "cleanNonResourceTabs"
      ) {
        await cleanNonResourceTabsInWorkspace(message.workspaceId);
        return { success: true } as const;
      } else if (
        typeof message === "object" &&
        message.type === "convertTabGroupToResource"
      ) {
        await convertTabGroupToResource(message.groupId);
        return { success: true } as const;
      } else if (
        typeof message === "object" &&
        message.type === "openResourcesAsTabs"
      ) {
        try {
          const urls = Array.from(
            new Set(
              (message.urls || []).filter((u): u is string => {
                if (!u) return false;
                try {
                  // Validate URL
                  const parsed = new URL(u);
                  return Boolean(parsed.protocol && parsed.hostname);
                } catch {
                  return false;
                }
              }),
            ),
          );

          if (urls.length === 0) return { success: false } as const;

          // Prefer the last focused window
          let targetWindowId: number | undefined;
          try {
            const lastFocused = await browser.windows.getLastFocused();
            targetWindowId = lastFocused?.id ?? undefined;
          } catch {
            targetWindowId = undefined;
          }

          for (const url of urls) {
            await browser.tabs.create({
              url,
              windowId: targetWindowId,
              active: false,
            });
          }

          return { success: true } as const;
        } catch (error) {
          console.error("Failed to open resources as tabs:", error);
          return { success: false, error: String(error) } as const;
        }
      } else if (
        typeof message === "object" &&
        message.type === "openResourcesAsGroup"
      ) {
        try {
          const urls = Array.from(
            new Set(
              (message.urls || []).filter((u): u is string => {
                if (!u) return false;
                try {
                  const parsed = new URL(u);
                  return Boolean(parsed.protocol && parsed.hostname);
                } catch {
                  return false;
                }
              }),
            ),
          );

          if (urls.length === 0) return { success: false } as const;

          // Determine target window
          let targetWindowId: number | undefined;
          try {
            const lastFocused = await browser.windows.getLastFocused();
            targetWindowId = lastFocused?.id ?? undefined;
          } catch {
            targetWindowId = undefined;
          }

          const createdTabIds: number[] = [];
          for (const url of urls) {
            const tab = await browser.tabs.create({
              url,
              windowId: targetWindowId,
              active: false,
            });
            if (tab.id != null) {
              createdTabIds.push(tab.id);
              // Capture windowId for subsequent tabs if first create returned one
              if (!targetWindowId && tab.windowId != null) {
                targetWindowId = tab.windowId;
              }
            }
          }

          if (createdTabIds.length >= 2 && targetWindowId != null) {
            const groupId = await browser.tabs.group({
              tabIds: createdTabIds as [number, ...number[]],
              createProperties: { windowId: targetWindowId },
            });
            await browser.tabGroups.update(groupId, {
              title: message.title,
              color: getRandomTabGroupColor(),
            });
          }

          return { success: true } as const;
        } catch (error) {
          console.error("Failed to open resources as a group:", error);
          return { success: false, error: String(error) } as const;
        }
      } else if (
        typeof message === "object" &&
        message.type === "createWorkspaceFromResources"
      ) {
        const res = await createWorkspaceFromUrls(message.name, message.urls);
        return res;
      } else if (
        typeof message === "object" &&
        message.type === "createWorkspaceFromTabGroup"
      ) {
        try {
          // Load tab group and its tabs
          const tabGroup = await db.tabGroups.get(message.groupId);
          if (!tabGroup) {
            return { success: false, error: "Tab group not found" } as const;
          }

          const tabsInGroup = await db.activeTabs
            .where("groupId")
            .equals(message.groupId)
            .toArray();

          const urls = tabsInGroup
            .map((t) => t.url)
            .filter((u): u is string => Boolean(u));

          const targetName = message.name || tabGroup.title || "New Workspace";
          const created = await createWorkspaceFromUrls(targetName, urls);

          if (!created.success || !created.workspaceId) {
            return created;
          }

          // On success: close original tabs and archive group + tabs
          const now = Date.now();
          const tabIdsToClose = tabsInGroup
            .map((tab) => tab.id)
            .filter((id): id is number => id !== undefined);

          if (tabIdsToClose.length > 0) {
            try {
              const existingTabs = await browser.tabs.query({});
              const existingTabIds = new Set(
                existingTabs
                  .map((t) => t.id)
                  .filter((id): id is number => id !== undefined),
              );
              const validTabIdsToClose = tabIdsToClose.filter((id) =>
                existingTabIds.has(id),
              );
              if (validTabIdsToClose.length > 0) {
                await browser.tabs.remove(validTabIdsToClose);
              }
            } catch (error) {
              console.error(
                "Error closing tabs while moving to workspace:",
                error,
              );
            }
          }

          // Archive tabs and group in DB
          const stableIdsToArchive = tabsInGroup.map((tab) => tab.stableId);
          await db.transaction("rw", db.activeTabs, db.tabGroups, async () => {
            if (stableIdsToArchive.length > 0) {
              await db.activeTabs
                .where("stableId")
                .anyOf(stableIdsToArchive)
                .modify({ tabStatus: "archived" });
            }
            await db.tabGroups.update(message.groupId, {
              groupStatus: "archived",
              updatedAt: now,
            });
          });

          return { success: true, workspaceId: created.workspaceId } as const;
        } catch (error) {
          console.error("Failed to create workspace from tab group:", error);
          return { success: false, error: String(error) } as const;
        }
      }
    },
  );
});
