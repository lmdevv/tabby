import { browser } from "wxt/browser";
import { db } from "@/lib/db/db";
import { UNGROUPED_TAB_GROUP_ID } from "@/lib/types/constants";
import type { TabGroup, Workspace } from "@/lib/types/types";

// Helper function to get the current workspace for tab groups
async function getTabGroupWorkspace(
  _windowId: number,
  getActiveWorkspace: () => Workspace | undefined,
): Promise<number> {
  const activeWorkspace = getActiveWorkspace();
  if (activeWorkspace) {
    return activeWorkspace.id;
  }
  // If no active workspace, associate with undefined workspace (-1)
  return -1;
}

// Helper function to sync all existing tab groups on startup
export async function syncAllTabGroups(
  getActiveWorkspace: () => Workspace | undefined,
): Promise<void> {
  try {
    // Get all current browser tab groups
    const browserTabGroups = await browser.tabGroups.query({});
    const now = Date.now();

    // Get existing active groups from DB (ignore archived ones for sync)
    const dbTabGroups = await db.tabGroups
      .where("groupStatus")
      .equals("active")
      .toArray();
    const dbGroupIds = new Set(dbTabGroups.map((g) => g.id));

    // Process each browser group
    const updatedGroups: TabGroup[] = [];
    const newGroups: TabGroup[] = [];

    for (const browserGroup of browserTabGroups) {
      const workspaceId = await getTabGroupWorkspace(
        browserGroup.windowId,
        getActiveWorkspace,
      );

      if (dbGroupIds.has(browserGroup.id)) {
        // Update existing group
        const existingGroup = dbTabGroups.find((g) => g.id === browserGroup.id);
        if (existingGroup) {
          const updatedGroup: TabGroup = {
            ...existingGroup,
            ...browserGroup,
            workspaceId,
            updatedAt: now,
          };
          updatedGroups.push(updatedGroup);
        }
      } else {
        // Add new group
        const newGroup: TabGroup = {
          ...browserGroup,
          stableId: crypto.randomUUID(),
          workspaceId,
          groupStatus: "active",
          createdAt: now,
          updatedAt: now,
        };
        newGroups.push(newGroup);
      }
    }

    // Archive groups that no longer exist in browser
    const browserGroupIds = new Set(browserTabGroups.map((g) => g.id));
    const groupsToArchive = dbTabGroups.filter(
      (g) => g.id !== undefined && !browserGroupIds.has(g.id),
    );

    // Execute database operations
    await db.transaction("rw", db.tabGroups, db.activeTabs, async () => {
      if (newGroups.length > 0) {
        await db.tabGroups.bulkAdd(newGroups);
      }

      if (updatedGroups.length > 0) {
        await db.tabGroups.bulkPut(updatedGroups);
      }

      if (groupsToArchive.length > 0) {
        const archivedGroups = groupsToArchive.map((group) => ({
          ...group,
          groupStatus: "archived" as const,
          updatedAt: now,
        }));
        await db.tabGroups.bulkPut(archivedGroups);

        // Unset groupId on tabs that referenced now-archived groups
        const groupIds = groupsToArchive
          .map((g) => g.id)
          .filter((id): id is number => id != null);
        if (groupIds.length > 0) {
          await db.activeTabs
            .where("groupId")
            .anyOf(groupIds)
            .modify((t) => {
              t.groupId = UNGROUPED_TAB_GROUP_ID;
              t.updatedAt = now;
            });
        }
      }
    });
  } catch (error) {
    console.error("❌ Error syncing tab groups:", error);
  }
}

export function setupTabGroupListeners(
  getActiveWorkspace: () => Workspace | undefined,
) {
  // Event: Tab group created
  browser.tabGroups.onCreated.addListener(async (group) => {
    try {
      const now = Date.now();
      const workspaceId = await getTabGroupWorkspace(
        group.windowId,
        getActiveWorkspace,
      );

      const newTabGroup: TabGroup = {
        ...group,
        stableId: crypto.randomUUID(),
        workspaceId,
        groupStatus: "active",
        createdAt: now,
        updatedAt: now,
      };

      await db.tabGroups.put(newTabGroup);
    } catch (error) {
      console.error(
        `❌ Error handling tab group creation for ${group.id}:`,
        error,
      );
    }
  });

  // Event: Tab group updated (title, color, collapsed state)
  browser.tabGroups.onUpdated.addListener(async (group) => {
    try {
      const existingGroup = await db.tabGroups.get(group.id);
      if (!existingGroup) {
        // If group not in DB, treat as new (might happen during sync issues)
        const now = Date.now();
        const workspaceId = await getTabGroupWorkspace(
          group.windowId,
          getActiveWorkspace,
        );

        const newTabGroup: TabGroup = {
          ...group,
          stableId: crypto.randomUUID(),
          workspaceId,
          groupStatus: "active",
          createdAt: now,
          updatedAt: now,
        };

        await db.tabGroups.put(newTabGroup);
        return;
      }

      const updatedGroup: TabGroup = {
        ...existingGroup,
        ...group,
        updatedAt: Date.now(),
        // Preserve database-specific fields
        stableId: existingGroup.stableId,
        workspaceId: existingGroup.workspaceId,
        createdAt: existingGroup.createdAt,
      };

      await db.tabGroups.put(updatedGroup);
    } catch (error) {
      console.error(
        `❌ Error handling tab group update for ${group.id}:`,
        error,
      );
    }
  });

  // Event: Tab group moved within window
  browser.tabGroups.onMoved.addListener(async (group) => {
    try {
      const existingGroup = await db.tabGroups.get(group.id);
      if (!existingGroup) {
        return;
      }

      const updatedGroup: TabGroup = {
        ...existingGroup,
        ...group,
        updatedAt: Date.now(),
      };

      await db.tabGroups.put(updatedGroup);
    } catch (error) {
      console.error(`❌ Error handling tab group move for ${group.id}:`, error);
    }
  });

  // Event: Tab group removed/deleted
  browser.tabGroups.onRemoved.addListener(async (group) => {
    try {
      const existingGroup = await db.tabGroups.get(group.id);
      if (!existingGroup) {
        return;
      }

      // Check if this removal is due to user action or workspace switching
      // If there are active tabs in this workspace that belonged to this group,
      // it's likely a user action (ungrouping/closing), so delete the group
      // If all tabs are archived or no tabs exist, it's likely workspace switching
      const activeTabsInGroup = await db.activeTabs
        .where("workspaceId")
        .equals(existingGroup.workspaceId)
        .and((tab) => tab.groupId === group.id && tab.tabStatus === "active")
        .toArray();

      const archivedTabsInGroup = await db.activeTabs
        .where("workspaceId")
        .equals(existingGroup.workspaceId)
        .and((tab) => tab.groupId === group.id && tab.tabStatus === "archived")
        .toArray();

      // Verify that tabs in the group actually exist in the browser
      if (activeTabsInGroup.length > 0) {
        const tabsToRemove: number[] = [];

        // Check each tab individually
        for (const tab of activeTabsInGroup) {
          if (tab.id != null) {
            try {
              await browser.tabs.get(tab.id);
              // Tab exists, keep it
            } catch {
              // Tab doesn't exist in browser, mark for removal
              tabsToRemove.push(tab.id);
            }
          }
        }

        if (tabsToRemove.length > 0) {
          console.log(
            `🧹 Cleaning up ${tabsToRemove.length} orphaned tabs from deleted group ${group.title || group.id}`,
          );
          await db.activeTabs.where("id").anyOf(tabsToRemove).delete();
        }
      }

      if (activeTabsInGroup.length === 0 && archivedTabsInGroup.length > 0) {
        // No active tabs but archived tabs exist - likely workspace switching
        const archivedGroup: TabGroup = {
          ...existingGroup,
          groupStatus: "archived",
          updatedAt: Date.now(),
        };
        await db.tabGroups.put(archivedGroup);
        console.log(`📦 Archived group: ${group.title || group.id}`);
      } else {
        // Active tabs exist or no tabs at all - likely user action (ungrouping/deleting)
        await db.tabGroups.delete(group.id);
        console.log(`🗑️ Deleted group: ${group.title || group.id}`);
      }
    } catch (error) {
      console.error(
        `❌ Error handling tab group removal for ${group.id}:`,
        error,
      );
    }
  });
}
