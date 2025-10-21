import { liveQuery } from "dexie";
import { browser } from "wxt/browser";
import {
  setupTabListeners,
  validateAllTabs,
} from "@/entrypoints/background/listeners/tab-listeners";
import {
  setupTabGroupListeners,
  syncAllTabGroups,
} from "@/entrypoints/background/listeners/tabGroup-listeners";
import {
  cleanDuplicateTabsInWorkspace,
  cleanNonResourceTabsInWorkspace,
  cleanResourceTabsInWorkspace,
  cleanUnusedTabsInWorkspace,
} from "@/entrypoints/background/operations/cleaning-operations";
import {
  reconcileTabs,
  refreshActiveTabs,
} from "@/entrypoints/background/operations/db-operations";
import { convertTabGroupToResource } from "@/entrypoints/background/operations/resource-operations";
import {
  groupTabsInWorkspace,
  sortTabsInWorkspace,
  ungroupTabsInWorkspace,
} from "@/entrypoints/background/operations/tab-operations";
import {
  activateWorkspace,
  createWorkspaceFromUrls,
} from "@/entrypoints/background/operations/workspace-operations";
import {
  createWorkspaceSnapshot,
  deleteSnapshot,
  restoreSnapshot,
  startSnapshotScheduler,
} from "@/entrypoints/background/snapshots";
import { isDashboardTab } from "@/entrypoints/background/utils";
import { db } from "@/lib/db/db";
import { getRandomTabGroupColor } from "@/lib/helpers/tab-helpers";
import type { RuntimeMessage, Workspace } from "@/lib/types/types";

export default defineBackground(() => {
  let activeWorkspace: Workspace | undefined;
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
