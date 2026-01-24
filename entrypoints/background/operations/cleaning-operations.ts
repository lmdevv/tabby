import { browser } from "wxt/browser";
import { isDashboardTab } from "@/entrypoints/background/utils";
import { db } from "@/lib/db/db";

/**
 * Cleans unused tabs in a workspace.
 *
 * @param workspaceId - The ID of the workspace to clean.
 * @param daysThreshold - The number of days a tab has to be unused to be cleaned.
 * @returns A Promise that resolves when the unused tabs are cleaned.
 */
export async function cleanUnusedTabsInWorkspace(
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

/**
 * Cleans duplicate tabs in a workspace.
 *
 * @param workspaceId - The ID of the workspace to clean.
 * @returns A Promise that resolves when the duplicate tabs are cleaned.
 */
export async function cleanDuplicateTabsInWorkspace(workspaceId: number) {
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

/**
 * Cleans resource tabs in a workspace.
 *
 * @param workspaceId - The ID of the workspace to clean.
 * @returns A Promise that resolves when the resource tabs are cleaned.
 */
export async function cleanResourceTabsInWorkspace(workspaceId: number) {
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

/**
 * Cleans non-resource tabs in a workspace.
 *
 * @param workspaceId - The ID of the workspace to clean.
 * @returns A Promise that resolves when the non-resource tabs are cleaned.
 */
export async function cleanNonResourceTabsInWorkspace(workspaceId: number) {
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
      (tab) => (!tab.url || !resourceUrls.has(tab.url)) && !isDashboardTab(tab),
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

/**
 * Cleans up an empty tab group.
 *
 * @param groupId - The ID of the tab group to clean up.
 * @param workspaceId - The ID of the workspace the tab group belongs to.
 * @returns A Promise that resolves when the tab group is cleaned up.
 */
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
        console.log(`🗑 Cleaned up empty group: ${group.title || groupId}`);
        return true; // Group was cleaned up
      }
    }
    return false; // Group not cleaned up
  } catch (error) {
    console.error(`Error cleaning up group ${groupId}:`, error);
    return false;
  }
}

/**
 * Cleans all tabs in a workspace.
 *
 * @param workspaceId - The ID of the workspace to clean.
 * @returns A Promise that resolves when all tabs are cleaned.
 */
export async function cleanAllTabsInWorkspace(workspaceId: number) {
  try {
    console.log(`🧹 Cleaning all tabs in workspace ${workspaceId}`);

    // Get only active tabs in the workspace
    const tabs = await db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .and((tab) => tab.tabStatus === "active")
      .toArray();

    // Filter out dashboard tabs
    const tabsToClean = tabs.filter((tab) => !isDashboardTab(tab));

    if (tabsToClean.length === 0) {
      console.log(`i No tabs to clean in workspace ${workspaceId}`);
      return;
    }

    // Close browser tabs that still exist
    const tabIdsToClose = tabsToClean
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
        console.error(`❌ Error closing all tabs:`, error);
      }
    }

    // Archive all tabs in database
    const stableIdsToArchive = tabsToClean.map((tab) => tab.stableId);
    if (stableIdsToArchive.length > 0) {
      await db.activeTabs
        .where("stableId")
        .anyOf(stableIdsToArchive)
        .modify({ tabStatus: "archived" });

      console.log(
        `✅ Cleaned ${tabsToClean.length} tabs from workspace ${workspaceId}`,
      );
    }
  } catch (error) {
    console.error(
      `❌ Failed to clean all tabs in workspace ${workspaceId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Closes specific tabs by their IDs in a workspace.
 *
 * @param workspaceId - The ID of the workspace the tabs belong to.
 * @param tabIds - Array of tab IDs to close.
 * @returns A Promise that resolves when the tabs are closed.
 */
/**
 * Purges archived tabs older than a threshold to free up storage.
 * @param daysThreshold - Delete archived tabs older than this many days (default: 30)
 * @returns The number of archived tabs deleted
 */
export async function purgeArchivedTabs(
  daysThreshold: number = 30,
): Promise<number> {
  const cutoffTime = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;

  const archivedTabsToDelete = await db.activeTabs
    .where("tabStatus")
    .equals("archived")
    .and((tab) => tab.updatedAt < cutoffTime)
    .toArray();

  if (archivedTabsToDelete.length === 0) return 0;

  const stableIdsToDelete = archivedTabsToDelete.map((t) => t.stableId);
  await db.activeTabs.where("stableId").anyOf(stableIdsToDelete).delete();

  console.log(`🗑️ Purged ${archivedTabsToDelete.length} old archived tabs`);
  return archivedTabsToDelete.length;
}

/**
 * Purges archived tab groups older than a threshold to free up storage.
 * @param daysThreshold - Delete archived groups older than this many days (default: 30)
 * @returns The number of archived tab groups deleted
 */
export async function purgeArchivedTabGroups(
  daysThreshold: number = 30,
): Promise<number> {
  const cutoffTime = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;

  const archivedGroupsToDelete = await db.tabGroups
    .where("groupStatus")
    .equals("archived")
    .and((group) => group.updatedAt < cutoffTime)
    .toArray();

  if (archivedGroupsToDelete.length === 0) return 0;

  const idsToDelete = archivedGroupsToDelete.map((g) => g.id);
  await db.tabGroups.where("id").anyOf(idsToDelete).delete();

  console.log(
    `🗑️ Purged ${archivedGroupsToDelete.length} old archived tab groups`,
  );
  return archivedGroupsToDelete.length;
}

export async function closeTabsByIdsInWorkspace(
  workspaceId: number,
  tabIds: number[],
) {
  try {
    console.log(`🧹 Closing ${tabIds.length} tabs in workspace ${workspaceId}`);

    if (tabIds.length === 0) {
      console.log("No tabs to close");
      return;
    }

    // Get tabs in the workspace to verify they exist and are active
    const workspaceTabs = await db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .and((tab) => tab.tabStatus === "active")
      .toArray();

    // Create a map of tab IDs for quick lookup
    const tabMap = new Map(workspaceTabs.map((tab) => [tab.id, tab]));

    // Filter to only include tabs that exist in our workspace
    const validTabIds = tabIds.filter((tabId) => tabMap.has(tabId));

    if (validTabIds.length !== tabIds.length) {
      console.log(
        `⚠️ Filtered out ${
          tabIds.length - validTabIds.length
        } tab IDs that don't exist in workspace ${workspaceId}`,
      );
    }

    if (validTabIds.length === 0) {
      console.log("No valid tabs to close after filtering");
      return;
    }

    // Query currently existing browser tabs
    const allBrowserTabs = await browser.tabs.query({});
    const liveTabIds = new Set(
      allBrowserTabs
        .map((t) => t.id)
        .filter((id): id is number => id !== undefined),
    );

    // Filter to only include tabs that are still live in the browser
    const liveTabIdsToClose = validTabIds.filter((id) => liveTabIds.has(id));

    if (liveTabIdsToClose.length !== validTabIds.length) {
      console.log(
        `⚠️ ${validTabIds.length - liveTabIdsToClose.length} tabs were already closed`,
      );
    }

    // Close browser tabs
    if (liveTabIdsToClose.length > 0) {
      await browser.tabs.remove(liveTabIdsToClose);
    }

    // Archive all tabs in database (including ones that were already closed)
    const stableIdsToArchive = validTabIds
      .map((tabId) => {
        const tab = tabMap.get(tabId);
        return tab?.stableId;
      })
      .filter((stableId): stableId is string => stableId !== undefined);

    if (stableIdsToArchive.length > 0) {
      await db.activeTabs
        .where("stableId")
        .anyOf(stableIdsToArchive)
        .modify({ tabStatus: "archived" });

      console.log(
        `✅ Closed ${liveTabIdsToClose.length} and archived ${stableIdsToArchive.length} tabs from workspace ${workspaceId}`,
      );
    }
  } catch (error) {
    console.error(
      `❌ Failed to close tabs by IDs in workspace ${workspaceId}:`,
      error,
    );
    throw error;
  }
}
