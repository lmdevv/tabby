import { browser } from "wxt/browser";
import type { Tab, Workspace } from "@/lib/types";
import { db } from "./db";
import { cleanupEmptyTabGroup, isDashboardTab, shiftIndices } from "./helpers";

// Helper function to validate and correct tab state with current browser state
async function validateTabState(tabId: number, dbTab: Tab): Promise<Tab> {
  try {
    const currentBrowserTab = await browser.tabs.get(tabId);

    // Check for mismatches and log them
    const mismatches: string[] = [];

    if (currentBrowserTab.windowId !== dbTab.windowId) {
      mismatches.push(
        `windowId: ${dbTab.windowId} → ${currentBrowserTab.windowId}`,
      );
    }

    if (currentBrowserTab.index !== dbTab.index) {
      mismatches.push(`index: ${dbTab.index} → ${currentBrowserTab.index}`);
    }

    if (currentBrowserTab.url !== dbTab.url) {
      mismatches.push(`url: ${dbTab.url} → ${currentBrowserTab.url}`);
    }

    if (mismatches.length > 0) {
      console.log(
        `🔧 [Tab ${tabId}] correcting mismatches:`,
        mismatches.join(", "),
      );

      // Return corrected tab state while preserving stableId and other metadata
      return {
        ...dbTab,
        ...currentBrowserTab,
        updatedAt: Date.now(),
        stableId: dbTab.stableId, // Preserve stableId
        workspaceId: dbTab.workspaceId, // Preserve workspace association
        tabStatus: dbTab.tabStatus, // Preserve status
        createdAt: dbTab.createdAt, // Preserve creation time
      };
    }

    return dbTab; // No changes needed
  } catch (error) {
    console.error(`Error validating tab state for ${tabId}:`, error);
    return dbTab; // Return original if validation fails
  }
}

// Export function to validate all tabs (can be called periodically)
export async function validateAllTabs(): Promise<void> {
  try {
    const allDbTabs = await db.activeTabs
      .where("tabStatus")
      .equals("active")
      .toArray();
    const updates: Tab[] = [];

    for (const dbTab of allDbTabs) {
      if (dbTab.id != null) {
        const correctedTab = await validateTabState(dbTab.id, dbTab);
        if (correctedTab !== dbTab) {
          updates.push(correctedTab);
        }
      }
    }

    if (updates.length > 0) {
      console.log(
        `🔄 Bulk updating ${updates.length} tabs with corrected state`,
      );
      await db.activeTabs.bulkPut(updates);
    }
  } catch (error) {
    console.error("Error during bulk tab validation:", error);
  }
}

export function setupTabListeners(
  getActiveWorkspace: () => Workspace | undefined,
) {
  browser.tabs.onCreated.addListener(async (tab) => {
    if (!tab.id || !tab.index || isDashboardTab(tab)) return;

    const activeWorkspace = getActiveWorkspace();
    if (activeWorkspace) {
      // Check if we have an existing tab with the same URL that might be archived
      const dbTab = await db.activeTabs
        .where("workspaceId")
        .equals(activeWorkspace.id)
        .and((t) => t.url === tab.url)
        .first();

      if (dbTab?.tabStatus === "archived") {
        console.log("Found tab archived, returning..");
        return;
      }
    }

    const now = Date.now();
    const newRow: Tab = {
      ...tab,
      stableId: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      tabStatus: "active",
      workspaceId: activeWorkspace ? activeWorkspace.id : -1,
    };

    await db.transaction("rw", db.activeTabs, async () => {
      await shiftIndices(tab.windowId, tab.index, +1);
      await db.activeTabs.put(newRow);
    });
  });

  browser.tabs.onRemoved.addListener(async (tabId) => {
    const dbTab = await db.activeTabs.get(tabId);
    if (!dbTab || dbTab.tabStatus === "archived") return;

    await db.transaction("rw", db.activeTabs, async () => {
      await shiftIndices(dbTab.windowId, dbTab.index + 1, -1);
      await db.activeTabs.delete(tabId);
    });

    // Check if the tab was in a group and if that group is now empty
    if (dbTab.groupId && dbTab.groupId !== -1) {
      await cleanupEmptyTabGroup(dbTab.groupId, dbTab.workspaceId);
    }
  });

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const dbTab = await db.activeTabs.get(tabId);
    if (!dbTab || dbTab.tabStatus === "archived" || isDashboardTab(tab)) return;

    const now = Date.now();

    // Check if groupId has changed (tab ungrouped or moved to different group)
    const groupIdChanged =
      "groupId" in changeInfo && changeInfo.groupId !== dbTab.groupId;

    if (groupIdChanged) {
      console.log(
        `🔗 [Tab ${tabId}] groupId changed: ${dbTab.groupId} → ${changeInfo.groupId}`,
      );

      // Check if the old group is now empty and should be cleaned up
      if (dbTab.groupId && dbTab.groupId !== -1) {
        // We need to check excluding the current tab since it's being moved
        const remainingTabsInOldGroup = await db.activeTabs
          .where("workspaceId")
          .equals(dbTab.workspaceId)
          .and(
            (t) =>
              t.groupId === dbTab.groupId &&
              t.id !== tabId &&
              t.tabStatus === "active",
          )
          .toArray();

        if (remainingTabsInOldGroup.length === 0) {
          const oldGroup = await db.tabGroups.get(dbTab.groupId);
          if (oldGroup && oldGroup.groupStatus === "active") {
            await db.tabGroups.delete(dbTab.groupId);
            console.log(
              `🗑️ Cleaned up empty group after ungrouping: ${oldGroup.title || dbTab.groupId}`,
            );
          }
        }
      }
    }

    // Check if windowId has changed (tab moved between windows)
    const windowIdChanged = tab.windowId && tab.windowId !== dbTab.windowId;
    const indexChanged = tab.index !== undefined && tab.index !== dbTab.index;

    if (windowIdChanged) {
      console.log(
        `🔄 [Tab ${tabId}] windowId changed: ${dbTab.windowId} → ${tab.windowId}`,
      );

      // Handle index shifts for both old and new windows
      if (dbTab.windowId && dbTab.index !== undefined) {
        // Shift indices in the old window
        await shiftIndices(dbTab.windowId, dbTab.index + 1, -1);
      }

      if (tab.windowId && tab.index !== undefined) {
        // Shift indices in the new window
        await shiftIndices(tab.windowId, tab.index, +1);
      }
    } else if (
      indexChanged &&
      tab.windowId &&
      tab.index !== undefined &&
      dbTab.index !== undefined
    ) {
      // Handle index changes within the same window
      const from = dbTab.index;
      const to = tab.index;

      if (from !== to) {
        console.log(
          `🔄 [Tab ${tabId}] index changed in window ${tab.windowId}: ${from} → ${to}`,
        );

        await db.transaction("rw", db.activeTabs, async () => {
          if (from < to) {
            // shift DOWN
            await db.activeTabs
              .where("windowId")
              .equals(tab.windowId)
              .and((t) => t.index > from && t.index <= to && t.id !== tabId)
              .modify((t) => {
                t.index -= 1;
                t.updatedAt = Date.now();
              });
          } else {
            // shift UP
            await db.activeTabs
              .where("windowId")
              .equals(tab.windowId)
              .and((t) => t.index >= to && t.index < from && t.id !== tabId)
              .modify((t) => {
                t.index += 1;
                t.updatedAt = Date.now();
              });
          }
        });
      }
    }

    const updated: Tab = {
      ...dbTab,
      ...tab,
      ...changeInfo,
      updatedAt: now,
      // Preserve the stableId from the existing database record
      stableId: dbTab.stableId,
    };

    await db.activeTabs.put(updated);
  });

  // Moving tabs across windows
  browser.tabs.onDetached.addListener(async (tabId, detachInfo) => {
    try {
      const dbTab = await db.activeTabs.get(tabId);
      if (!dbTab || dbTab.tabStatus === "archived") return;

      const { oldWindowId, oldPosition } = detachInfo;
      console.log(
        `🔓 [Tab ${tabId}] detached from window ${oldWindowId} at position ${oldPosition}`,
      );

      await shiftIndices(oldWindowId, oldPosition + 1, -1);
    } catch (error) {
      console.error(`Error handling tab detach for ${tabId}:`, error);
    }
  });

  browser.tabs.onAttached.addListener(async (tabId, attachInfo) => {
    try {
      const dbTab = await db.activeTabs.get(tabId);
      if (!dbTab || dbTab.tabStatus === "archived") return;

      const { newWindowId, newPosition } = attachInfo;
      const now = Date.now();

      console.log(
        `🔗 [Tab ${tabId}] attached to window ${newWindowId} at position ${newPosition}`,
      );

      await db.transaction("rw", db.activeTabs, async () => {
        await shiftIndices(newWindowId, newPosition, +1);

        // Update tab with new window and position info while preserving stableId
        await db.activeTabs.put({
          ...dbTab,
          windowId: newWindowId,
          index: newPosition,
          updatedAt: now,
          // stableId is already preserved in the dbTab object
        });
      });
    } catch (error) {
      console.error(`Error handling tab attach for ${tabId}:`, error);
    }
  });

  // Moving tabs within the same window
  browser.tabs.onMoved.addListener(async (tabId, moveInfo) => {
    try {
      const dbTab = await db.activeTabs.get(tabId);
      if (!dbTab || dbTab.tabStatus === "archived") return;

      const { windowId, fromIndex: from, toIndex: to } = moveInfo;
      if (from === to) return;

      console.log(
        `🔀 [Tab ${tabId}] moved in window ${windowId}: ${from} → ${to}`,
      );

      // Ensure windowId is current in our database
      if (dbTab.windowId !== windowId) {
        console.log(
          `⚠️ [Tab ${tabId}] windowId mismatch in move event. DB: ${dbTab.windowId}, Event: ${windowId}. Updating...`,
        );
      }

      await db.transaction("rw", db.activeTabs, async () => {
        if (from < to) {
          // shift DOWN - exclude the moved tab itself
          await db.activeTabs
            .where("windowId")
            .equals(windowId)
            .and((t) => t.index > from && t.index <= to && t.id !== tabId)
            .modify((t) => {
              t.index -= 1;
              t.updatedAt = Date.now();
            });
        } else {
          // shift UP - exclude the moved tab itself
          await db.activeTabs
            .where("windowId")
            .equals(windowId)
            .and((t) => t.index >= to && t.index < from && t.id !== tabId)
            .modify((t) => {
              t.index += 1;
              t.updatedAt = Date.now();
            });
        }

        // Update the moved tab with correct window and position
        await db.activeTabs.put({
          ...dbTab,
          windowId: windowId, // Ensure windowId is current
          index: to,
          updatedAt: Date.now(),
          // stableId is already preserved in the dbTab object
        });
      });
    } catch (error) {
      console.error(`Error handling tab move for ${tabId}:`, error);
    }
  });
}
