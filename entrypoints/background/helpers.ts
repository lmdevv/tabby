import { browser } from "wxt/browser";
import type { Tab } from "@/lib/types";
import { db } from "./db";

// Helper function to reliably identify dashboard tabs
export function isDashboardTab(tab: Browser.tabs.Tab): boolean {
  if (!tab.url) {
    return false;
  }

  const ourExtensionBaseURL = browser.runtime.getURL("");
  const specificDashboardURL = browser.runtime.getURL("/dashboard.html");

  if (tab.url === specificDashboardURL) {
    return true;
  }

  if (tab.url.startsWith(ourExtensionBaseURL)) {
    if (
      tab.url.includes("/dashboard") ||
      tab.title?.toLowerCase().includes("tab manager")
    ) {
      return true;
    }
  }
  return false;
}

// Helper function to clean up empty tab groups
export async function cleanupEmptyTabGroup(
  groupId: number,
  workspaceId: number,
) {
  try {
    const remainingTabsInGroup = await db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .and((t) => t.groupId === groupId && t.tabStatus === "active")
      .toArray();

    if (remainingTabsInGroup.length === 0) {
      const group = await db.tabGroups.get(groupId);
      if (group && group.groupStatus === "active") {
        await db.tabGroups.delete(groupId);
        console.log(`🗑️ Cleaned up empty group: ${group.title || groupId}`);
        return true; // Group was cleaned up
      }
    }
    return false; // Group not cleaned up
  } catch (error) {
    console.error(`Error cleaning up group ${groupId}:`, error);
    return false;
  }
}

export async function refreshActiveTabs() {
  const liveTabs = await browser.tabs.query({});
  const activeWorkspace = await db.workspaces.where("active").equals(1).first();

  // Use workspace ID -1 for undefined/unassigned tabs when no workspace is active
  const targetWorkspaceId = activeWorkspace ? activeWorkspace.id : -1;

  // Filter out dashboard tabs from live tabs
  const nonDashboardTabs = liveTabs.filter((tab) => {
    return !isDashboardTab(tab);
  });

  // Only clear non-dashboard tabs for the target workspace
  await db.activeTabs
    .where("workspaceId")
    .equals(targetWorkspaceId)
    .and(
      (tab) =>
        tab.tabStatus === "active" && !isDashboardTab(tab as Browser.tabs.Tab),
    )
    .delete();

  const now = Date.now();
  const toAdd = nonDashboardTabs.map(
    (t): Tab => ({
      ...t,
      stableId: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      tabStatus: "active",
      workspaceId: targetWorkspaceId,
    }),
  );

  await db.activeTabs.bulkPut(toAdd);
}

export async function shiftIndices(
  windowId: number,
  start: number,
  delta: number, // +1 or –1
) {
  if (delta === 0) return;
  const now = Date.now();

  await db.activeTabs
    .where("windowId")
    .equals(windowId)
    .and((t) => t.index >= start)
    .modify((t) => {
      t.index += delta;
      t.updatedAt = now;
    });
}

// NOTE: this is for debug only
export async function reconcileTabs() {
  const now = Date.now();

  const activeWorkspace = await db.workspaces.where("active").equals(1).first(); // TODO: this is getting repeated, maybe send as param or check if dexie optimizes when we call multiple times the same stuff

  // Use workspace ID -1 for undefined/unassigned tabs when no workspace is active
  const targetWorkspaceId = activeWorkspace ? activeWorkspace.id : -1;

  // 1. fetch live tabs from Chrome (excluding dashboard tabs)
  const allLiveTabs = await browser.tabs.query({});
  const liveTabs = allLiveTabs.filter((tab) => {
    return !isDashboardTab(tab);
  });

  // Create maps for live tabs - both by browser ID and by URL for fallback matching
  const liveTabsByBrowserId = new Map<number, Browser.tabs.Tab>();
  const liveTabsByUrl = new Map<string, Browser.tabs.Tab[]>();

  for (const tab of liveTabs) {
    if (tab.id != null) {
      liveTabsByBrowserId.set(tab.id, tab);
    }
    if (tab.url) {
      if (!liveTabsByUrl.has(tab.url)) {
        liveTabsByUrl.set(tab.url, []);
      }
      const urlTabs = liveTabsByUrl.get(tab.url);
      if (urlTabs) {
        urlTabs.push(tab);
      }
    }
  }

  // 2. fetch stored tabs from IndexedDB - ONLY for the target workspace (excluding dashboard tabs)
  const storedTabs = await db.activeTabs
    .where("workspaceId")
    .equals(targetWorkspaceId)
    .and(
      (tab) =>
        tab.tabStatus === "active" && !isDashboardTab(tab as Browser.tabs.Tab),
    )
    .toArray();

  // Create maps for stored tabs by browser ID and stableId
  const storedTabsByBrowserId = new Map<number, Tab>();
  const storedTabsByStableId = new Map<string, Tab>();
  const storedTabsByUrl = new Map<string, Tab[]>();

  for (const tab of storedTabs) {
    if (tab.id != null) {
      storedTabsByBrowserId.set(tab.id, tab);
    }
    storedTabsByStableId.set(tab.stableId, tab);
    if (tab.url) {
      if (!storedTabsByUrl.has(tab.url)) {
        storedTabsByUrl.set(tab.url, []);
      }
      const urlTabs = storedTabsByUrl.get(tab.url);
      if (urlTabs) {
        urlTabs.push(tab);
      }
    }
  }

  // Track which tabs have been matched to avoid duplicates
  const matchedLiveTabIds = new Set<number>();
  const matchedStoredStableIds = new Set<string>();

  // 3. Primary matching: by browser tab ID (most reliable for existing tabs)
  for (const [browserId, liveTab] of liveTabsByBrowserId.entries()) {
    const storedTab = storedTabsByBrowserId.get(browserId);
    if (storedTab) {
      matchedLiveTabIds.add(browserId);
      matchedStoredStableIds.add(storedTab.stableId);

      // Update stored tab with current browser state while preserving stableId
      const fieldsToCheck: (keyof Browser.tabs.Tab)[] = [
        "url",
        "title",
        "pinned",
        "index",
        "groupId",
        "windowId",
      ];

      let hasChanges = false;
      const diffs: Array<{ field: string; old: unknown; new: unknown }> = [];

      for (const field of fieldsToCheck) {
        const oldVal = storedTab[field];
        const newVal = liveTab[field];
        if (oldVal !== newVal) {
          hasChanges = true;
          diffs.push({ field, old: oldVal, new: newVal });
        }
      }

      if (hasChanges) {
        console.log(
          `✏ [Tab ${browserId} – "${liveTab.title}"] detected changes:`,
        );
        for (const { field, old, new: newer } of diffs) {
          console.log(`   • ${field}:`, `"${old}"`, "→", `"${newer}"`);
        }
        await db.activeTabs.put({
          ...storedTab,
          ...liveTab,
          updatedAt: now,
          stableId: storedTab.stableId, // Preserve stableId
        } as Tab);
      }
    }
  }

  // 4. Secondary matching: by URL for tabs that lost their browser ID (moved windows, etc.)
  for (const [browserId, liveTab] of liveTabsByBrowserId.entries()) {
    if (matchedLiveTabIds.has(browserId) || !liveTab.url) continue;

    const candidateStoredTabs = storedTabsByUrl.get(liveTab.url) || [];

    // Find an unmatched stored tab with the same URL
    const unmatchedStoredTab = candidateStoredTabs.find(
      (tab) => !matchedStoredStableIds.has(tab.stableId),
    );

    if (unmatchedStoredTab) {
      matchedLiveTabIds.add(browserId);
      matchedStoredStableIds.add(unmatchedStoredTab.stableId);

      console.log(
        `🔗 [Tab ${browserId}] matched by URL to stableId ${unmatchedStoredTab.stableId}: ${liveTab.title}`,
      );

      // Update the stored tab with new browser ID and current state
      await db.activeTabs.put({
        ...unmatchedStoredTab,
        ...liveTab,
        updatedAt: now,
        stableId: unmatchedStoredTab.stableId, // Preserve stableId
      } as Tab);
    }
  }

  // 5. Handle new tabs (no match found by ID or URL)
  for (const [browserId, liveTab] of liveTabsByBrowserId.entries()) {
    if (!matchedLiveTabIds.has(browserId)) {
      console.log(
        `🆕 [Tab ${browserId}] new tab added:`,
        liveTab.title,
        liveTab.url,
      );
      await db.activeTabs.put({
        ...liveTab,
        stableId: crypto.randomUUID(),
        workspaceId: targetWorkspaceId,
        createdAt: now,
        updatedAt: now,
        tabStatus: "active",
      } satisfies Tab);
    }
  }

  // 6. Handle removed tabs (stored tabs with no live match)
  for (const storedTab of storedTabs) {
    if (!matchedStoredStableIds.has(storedTab.stableId)) {
      console.log(
        `🗑️ [StableId ${storedTab.stableId}] tab removed: ${storedTab.title}`,
      );
      // Use stableId to find and delete the tab instead of browser ID
      await db.activeTabs.where("stableId").equals(storedTab.stableId).delete();
    }
  }
}

export async function switchWorkspaceTabs(workspaceId: number) {
  try {
    // Get tabs for the new workspace from the database
    const workspaceTabsToOpen = await db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .toArray();

    // Get tab groups for the new workspace from the database (including archived ones)
    const workspaceTabGroups = await db.tabGroups
      .where("workspaceId")
      .equals(workspaceId)
      .toArray();

    // Group tabs by their original window IDs and sort by index within each window
    const tabsByWindow = new Map<number, Tab[]>();
    for (const tab of workspaceTabsToOpen) {
      const windowId = tab.windowId;
      if (!tabsByWindow.has(windowId)) {
        tabsByWindow.set(windowId, []);
      }
      const windowTabs = tabsByWindow.get(windowId);
      if (windowTabs) {
        windowTabs.push(tab);
      }
    }

    // Sort tabs within each window by index
    for (const tabs of tabsByWindow.values()) {
      tabs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    }

    // 2. Identify all currently open browser tabs and the first dashboard tab
    const allCurrentBrowserTabs = await browser.tabs.query({});
    let dashboardPersistenceInfo:
      | { tabId: number; windowId: number }
      | undefined;
    const nonDashboardTabIdsToClose: number[] = [];

    for (const tab of allCurrentBrowserTabs) {
      if (tab.id != null) {
        if (isDashboardTab(tab)) {
          // Store info of the first dashboard tab found
          if (!dashboardPersistenceInfo && tab.windowId != null) {
            dashboardPersistenceInfo = {
              tabId: tab.id,
              windowId: tab.windowId,
            };
          }
          // Dashboard tabs are not added to the list of tabs to close
        } else {
          nonDashboardTabIdsToClose.push(tab.id);
        }
      }
    }

    // 3. Close all non-dashboard tabs
    if (nonDashboardTabIdsToClose.length > 0) {
      await browser.tabs.remove(nonDashboardTabIdsToClose);
    }

    // 4. Create windows and restore tabs with proper window structure
    const windowMapping = new Map<number, number>(); // old windowId -> new windowId
    const sortedWindowIds = Array.from(tabsByWindow.keys()).sort(
      (a, b) => a - b,
    );

    for (let i = 0; i < sortedWindowIds.length; i++) {
      const originalWindowId = sortedWindowIds[i];
      let targetWindowId: number;

      if (i === 0 && dashboardPersistenceInfo) {
        // Use the dashboard window for the first set of tabs
        try {
          await browser.windows.get(dashboardPersistenceInfo.windowId);
          targetWindowId = dashboardPersistenceInfo.windowId;
        } catch (e) {
          console.warn(
            `Dashboard's original window ${dashboardPersistenceInfo.windowId} no longer exists. Creating new window.`,
            e,
          );
          const newWindow = await browser.windows.create({ focused: true });
          if (!newWindow || newWindow.id === undefined) {
            console.error("Failed to create a new window.");
            continue;
          }
          targetWindowId = newWindow.id;
        }
      } else {
        // Create new windows for additional window groups
        const newWindow = await browser.windows.create({ focused: false });
        if (!newWindow || newWindow.id === undefined) {
          console.error("Failed to create a new window.");
          continue;
        }
        targetWindowId = newWindow.id;
      }

      windowMapping.set(originalWindowId, targetWindowId);

      // Open tabs in this window
      const tabsForWindow = tabsByWindow.get(originalWindowId);
      if (!tabsForWindow) continue;

      // Map to track old tab ID to new tab ID for grouping
      const tabIdMapping = new Map<number, number>();

      for (const tabData of tabsForWindow) {
        if (tabData.url) {
          try {
            const newTab = await browser.tabs.create({
              windowId: targetWindowId,
              url: tabData.url,
              pinned: tabData.pinned,
              active: false, // Open in background initially
            });

            // Update the tab in the database with new browser IDs while preserving stableId
            if (newTab.id && newTab.windowId) {
              if (tabData.id) {
                tabIdMapping.set(tabData.id, newTab.id);
              }

              await db.activeTabs.put({
                ...tabData,
                id: newTab.id,
                windowId: newTab.windowId,
                index: newTab.index,
                updatedAt: Date.now(),
                // stableId is preserved from tabData
              });
            }
          } catch (createError) {
            console.error(
              `Failed to create tab for URL: ${tabData.url}`,
              createError,
            );
          }
        }
      }

      // Now restore tab groups for this window
      const groupsInWindow = workspaceTabGroups.filter(
        (group) => group.windowId === originalWindowId,
      );

      for (const groupData of groupsInWindow) {
        try {
          // Find tabs that belong to this group and get their new IDs
          const tabsInGroup = tabsForWindow.filter(
            (tab) => tab.groupId === groupData.id,
          );
          const newTabIds = tabsInGroup
            .map((tab) => (tab.id ? tabIdMapping.get(tab.id) : undefined))
            .filter((id): id is number => id !== undefined);

          if (newTabIds.length > 0) {
            // Create the group with the tabs
            const newGroupId = await browser.tabs.group({
              tabIds: newTabIds,
              createProperties: { windowId: targetWindowId },
            });

            // Update the group properties (title, color, collapsed state)
            await browser.tabGroups.update(newGroupId, {
              title: groupData.title,
              color: groupData.color,
              collapsed: groupData.collapsed,
            });

            // Update the group in the database with new browser ID while preserving stableId
            // Also set status to "active" since we're restoring it
            await db.tabGroups.put({
              ...groupData,
              id: newGroupId,
              windowId: targetWindowId,
              groupStatus: "active",
              updatedAt: Date.now(),
              // stableId is preserved from groupData
            });

            // Update all tabs in this group to have the new groupId
            for (const newTabId of newTabIds) {
              await db.activeTabs
                .where("id")
                .equals(newTabId)
                .modify({ groupId: newGroupId, updatedAt: Date.now() });
            }

            console.log(
              `✅ Restored group "${groupData.title}" with ${newTabIds.length} tabs`,
            );
          }
        } catch (groupError) {
          console.error(
            `Failed to restore group "${groupData.title}":`,
            groupError,
          );
        }
      }
    }

    // Remove archived tabs from database
    await db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .and((t) => t.tabStatus === "archived")
      .delete();

    // Remove archived tabs and groups from database
    await db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .and((t) => t.tabStatus === "archived")
      .delete();

    await db.tabGroups
      .where("workspaceId")
      .equals(workspaceId)
      .and((g) => g.groupStatus === "archived")
      .delete();

    // Focus the first window (dashboard window)
    if (dashboardPersistenceInfo) {
      await browser.windows.update(dashboardPersistenceInfo.windowId, {
        focused: true,
      });
    } else if (windowMapping.size > 0) {
      const firstNewWindowId = Array.from(windowMapping.values())[0];
      await browser.windows.update(firstNewWindowId, { focused: true });
    }
  } catch (e) {
    console.error("Error switching workspace tabs:", e);
  }
}
