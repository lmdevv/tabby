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
import { registerMessageHandlers } from "@/entrypoints/background/messages";
import {
  purgeArchivedTabGroups,
  purgeArchivedTabs,
} from "@/entrypoints/background/operations/cleaning-operations";
import {
  hardRefreshTabsAndGroups,
  reconcileTabs,
} from "@/entrypoints/background/operations/db-operations";
import {
  initSnapshotScheduler,
  restoreSnapshot,
} from "@/entrypoints/background/snapshots";
import { db } from "@/lib/db/db";

export default defineBackground(() => {
  let activeWorkspace: import("@/lib/types/types").Workspace | undefined;
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

      // One-time migration: Clean up existing large data URLs from favIconUrl
      const migrationKey = "migration:v1-cleanup-favicons";
      const migrationDone = await db.state
        .where("key")
        .equals(migrationKey)
        .first();

      if (!migrationDone) {
        console.log("🔄 Running one-time data cleanup migration...");

        // Strip data URLs from existing tabs
        const allDbTabs = await db.activeTabs.toArray();
        const tabsToUpdate = allDbTabs.filter((t) =>
          t.favIconUrl?.startsWith("data:"),
        );

        for (const tab of tabsToUpdate) {
          await db.activeTabs.update(tab.id, { favIconUrl: undefined });
        }

        // Purge old archived data aggressively
        await purgeArchivedTabs(14);
        await purgeArchivedTabGroups(14);

        // Mark migration complete
        const now = Date.now();
        await db.state.add({
          key: migrationKey,
          value: "done",
          createdAt: now,
          updatedAt: now,
        });

        console.log(
          `✅ Migration complete: cleaned ${tabsToUpdate.length} tabs`,
        );
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
    initSnapshotScheduler(() => activeWorkspace);
  } catch (e) {
    console.error(e);
  }

  // Setup tab listeners
  setupTabListeners(() => activeWorkspace);

  // Setup tab group listeners
  setupTabGroupListeners(() => activeWorkspace);

  //
  // Periodic operations
  //

  // Scheduling via alarms to survive SW suspension
  try {
    browser.alarms.create("reconcileTabs", { periodInMinutes: 5 });
    browser.alarms.create("validateTabs", { periodInMinutes: 5 });
    browser.alarms.create("syncTabGroups", { periodInMinutes: 5 });
    browser.alarms.create("purgeArchivedData", { periodInMinutes: 60 }); // Run hourly

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
      } else if (alarm.name === "purgeArchivedData") {
        Promise.all([purgeArchivedTabs(30), purgeArchivedTabGroups(30)]).catch(
          (err) => console.error("Periodic archive cleanup failed:", err),
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

  //
  // Browser Startup Handling
  //
  browser.runtime.onStartup.addListener(async () => {
    console.log("🚀 Browser startup detected");
    try {
      // Wait a bit for workspace to be initialized
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get active workspace
      const workspace = await db.workspaces.where("active").equals(1).first();
      if (!workspace) {
        console.log(
          "No active workspace found on startup, skipping startup handling",
        );
        return;
      }

      // Get startup preference (defaults to false if not set)
      const startupState = await db.state
        .where("key")
        .equals("startup:autoRollback")
        .first();
      const autoRollback = startupState?.value === "true";

      if (autoRollback) {
        // Auto-rollback: Restore latest snapshot
        console.log("📸 Auto-rollback enabled, restoring latest snapshot");
        const snapshots = await db.workspaceSnapshots
          .where("workspaceId")
          .equals(workspace.id)
          .reverse()
          .sortBy("createdAt");

        if (snapshots.length > 0) {
          const latestSnapshot = snapshots[0];
          const result = await restoreSnapshot(latestSnapshot.id, "replace");
          if (result.success) {
            console.log(`✅ Restored snapshot ${latestSnapshot.id} on startup`);
          } else {
            console.error(
              `❌ Failed to restore snapshot on startup: ${result.error}`,
            );
          }
        } else {
          console.log("No snapshots available for auto-rollback");
        }
      } else {
        // Hard refresh: Sync DB with browser state
        console.log("🔄 Auto-rollback disabled, performing hard refresh");
        await hardRefreshTabsAndGroups();
      }
    } catch (error) {
      console.error("❌ Error handling browser startup:", error);
    }
  });
});
