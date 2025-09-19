import { liveQuery } from "dexie";
import { browser } from "wxt/browser";
import type { RuntimeMessage, Workspace } from "@/lib/types";
import { db } from "./db";
import {
  isDashboardTab,
  reconcileTabs,
  refreshActiveTabs,
  switchWorkspaceTabs,
} from "./helpers";
import { setupTabListeners, validateAllTabs } from "./tab-listeners";
import { setupTabGroupListeners, syncAllTabGroups } from "./tabGroup-listeners";

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

            color: message.color as Browser.tabGroups.ColorEnum,
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
      }
    },
  );
});
