import { liveQuery } from "dexie";
import { browser } from "wxt/browser";
import {
  isDashboardTab,
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
import { db } from "@/lib/db";
import type { RuntimeMessage, Workspace } from "@/lib/types";

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

  // Open dashboard in new windows
  // browser.windows.onCreated.addListener(async (window) => {
  //   try {
  //     await browser.tabs.create({
  //       windowId: window.id,
  //       url: browser.runtime.getURL("/dashboard.html"),
  //       pinned: true,
  //       active: true,
  //       index: 0,
  //     });
  //   } catch (err) {
  //     console.error("Failed to open dashboard in new window:", err);
  //   }
  // });

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

  //
  // Helper functions
  //
  function getDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return "";
    }
  }

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

  // Helper function to get a random tab group color
  function getRandomTabGroupColor() {
    const colors = [
      "grey",
      "blue",
      "red",
      "yellow",
      "green",
      "pink",
      "purple",
      "cyan",
    ] as const;
    return colors[Math.floor(Math.random() * colors.length)];
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
  browser.runtime.onMessage.addListener((message: RuntimeMessage, _sender) => {
    if (typeof message === "object" && message.type === "refreshTabs") {
      console.log("Reconciling tabs ");
      reconcileTabs().catch((err) => {
        console.error("Reconciliation failed:", err);
      });
    }
  });

  // Handle extension icon click
  browser.action.onClicked.addListener((_tab) => {
    handleActionClick().catch((err) => {
      console.error("Failed to handle action click:", err);
    });
  });

  // Maybe this could be done on dashboard? without relying on service worker? idk if that would be better or more reliable
  // TODO: Make one big ops for db for atomic updates
  // NOTE: on the logs, this updatetabgroup is getting logged on application console, not service worker, so this message comm doesnt even need to be necessary then
  browser.runtime.onMessage.addListener(
    async (message: RuntimeMessage, _sender) => {
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

        // Get the current active workspace before switching
        const currentActiveWorkspace = await db.workspaces
          .where("active")
          .equals(1)
          .first();

        // Special handling for undefined workspace conversion
        const isConvertingFromUndefined =
          !currentActiveWorkspace && message.skipTabSwitching;

        // Archive all tabs from the current active workspace (only if there is one)
        if (currentActiveWorkspace) {
          await db.activeTabs
            .where("workspaceId")
            .equals(currentActiveWorkspace.id)
            .modify({ tabStatus: "archived" });
        }

        // make active workspace the new workspace
        await db.workspaces.where("id").equals(message.workspaceId).modify({
          active: 1,
        });

        // make all other workspaces inactive
        await db.workspaces.where("id").notEqual(message.workspaceId).modify({
          active: 0,
        });

        if (isConvertingFromUndefined) {
          // For undefined workspace conversion, just refresh to ensure fresh state
          // without closing and reopening tabs
          await reconcileTabs();
        } else {
          // Normal workspace switching: close current tabs and open workspace tabs
          await switchWorkspaceTabs(message.workspaceId);
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
      } else if (typeof message === "object" && message.type === "sortTabs") {
        await sortTabsInWindow(message.windowId, message.sortType);
        return { success: true } as const;
      } else if (typeof message === "object" && message.type === "groupTabs") {
        await groupTabsInWindow(message.windowId, message.groupType);
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
      }
    },
  );
});
