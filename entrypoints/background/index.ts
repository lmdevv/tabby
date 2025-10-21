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
import { UNASSIGNED_WORKSPACE_ID } from "@/lib/types/constants";
import { db } from "@/lib/db/db";
import { getRandomTabGroupColor } from "@/lib/helpers/tab-helpers";
import type { RuntimeMessage, Workspace } from "@/lib/types/types";
import { registerMessageHandlers } from "@/entrypoints/background/messages";

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

  // Scheduling via alarms to survive SW suspension
  try {
    browser.alarms.create("reconcileTabs", { periodInMinutes: 10 });
    browser.alarms.create("validateTabs", { periodInMinutes: 10 });
    browser.alarms.create("syncTabGroups", { periodInMinutes: 10 });

    browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === "reconcileTabs") {
        reconcileTabs().catch((err) =>
          console.error("Periodic reconciliation failed:", err),
        );
      } else if (alarm.name === "validateTabs") {
        validateAllTabs().catch((err) =>
          console.error("Periodic tab validation failed:", err),
        );
      } else if (alarm.name === "syncTabGroups") {
        syncAllTabGroups(() => activeWorkspace).catch((err) =>
          console.error("Periodic tab group sync failed:", err),
        );
      }
    });
  } catch (e) {
    console.error("Failed to initialize alarms:", e);
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

  // Register message handlers
  registerMessageHandlers(() => activeWorkspace);
});
