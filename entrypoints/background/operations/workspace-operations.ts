import { browser } from "wxt/browser";
import { reconcileTabs } from "@/entrypoints/background/operations/db-operations";
import { isDashboardTab } from "@/entrypoints/background/utils";
import { db } from "@/lib/db/db";
import type { Tab, Workspace } from "@/lib/types/types";

/**
 * Activates a workspace and optionally skips restoring from the database.
 *
 * @param workspaceId - The ID of the workspace to activate.
 * @param opts - An optional object containing options.
 * @param opts.skipTabSwitching - A boolean indicating whether to skip switching tabs.
 * @returns A Promise that resolves when the workspace is activated.
 */
export async function activateWorkspace(
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

/**
 * Creates a workspace from a list of URLs.
 *
 * @param name - The name of the workspace to create.
 * @param urls - An array of URLs to open in the workspace.
 * @returns A Promise that resolves with an object containing success, workspaceId, and error properties.
 */
export async function createWorkspaceFromUrls(
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

/**
 * Switches the tabs of a workspace.
 *
 * @param workspaceId - The ID of the workspace to switch tabs for.
 * @returns A Promise that resolves when the tabs are switched.
 */
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
                tabStatus: "active",
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
              tabIds: newTabIds as [number, ...number[]],
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

    // Do not delete archived tabs/groups; they are needed to restore other workspaces

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
