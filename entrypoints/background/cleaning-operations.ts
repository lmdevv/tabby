import { browser } from "wxt/browser";
import { db } from "@/lib/db/db";
import { isDashboardTab } from "./utils";

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
 * Converts a tab group to a resource.
 *
 * @param groupId - The ID of the tab group to convert.
 * @returns A Promise that resolves when the tab group is converted.
 */
export async function convertTabGroupToResource(groupId: number) {
  try {
    console.log(`Converting tab group ${groupId} to resource`);

    // Get the tab group
    const tabGroup = await db.tabGroups.get(groupId);
    if (!tabGroup) {
      throw new Error(`Tab group with ID ${groupId} not found`);
    }

    // Get all tabs in this group
    const tabsInGroup = await db.activeTabs
      .where("groupId")
      .equals(groupId)
      .toArray();

    if (tabsInGroup.length === 0) {
      throw new Error(`No tabs found in group ${groupId}`);
    }

    // Get the workspace this group belongs to
    const workspace = await db.workspaces.get(tabGroup.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace with ID ${tabGroup.workspaceId} not found`);
    }

    // Create a resource group
    const timestamp = Date.now();
    const resourceGroupId = (await db.resourceGroups.count()) + 1;
    const resourceGroup = {
      id: resourceGroupId,
      name: tabGroup.title || "Converted Tab Group",
      collapsed: 0 as const,
      resourceIds: [] as string[],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await db.resourceGroups.add(resourceGroup);

    // Create resources from tabs
    const resourceIds: string[] = [];
    for (const tab of tabsInGroup) {
      if (!tab.url) continue;

      const resource = {
        id: (await db.resources.count()) + 1,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        tags: tab.tags,
        description: tab.description,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await db.resources.add(resource);
      resourceIds.push(resource.id.toString());
    }

    // Update resource group with resource IDs
    await db.resourceGroups.update(resourceGroupId, {
      resourceIds,
      updatedAt: timestamp,
    });

    // Add resource group to workspace
    const updatedResourceGroupIds = [
      ...(workspace.resourceGroupIds || []),
      resourceGroupId,
    ];
    await db.workspaces.update(workspace.id, {
      resourceGroupIds: updatedResourceGroupIds,
    });

    // Close browser tabs that still exist
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
        console.error(`❌ Error closing tabs in group:`, error);
      }
    }

    // Archive all tabs in the database
    const stableIdsToArchive = tabsInGroup.map((tab) => tab.stableId);
    await db.activeTabs
      .where("stableId")
      .anyOf(stableIdsToArchive)
      .modify({ tabStatus: "archived" });

    // Archive the tab group
    await db.tabGroups.update(groupId, {
      groupStatus: "archived",
      updatedAt: timestamp,
    });

    console.log(
      `✅ Converted tab group ${groupId} to resource group ${resourceGroupId} with ${resourceIds.length} resources`,
    );
  } catch (error) {
    console.error(
      `❌ Failed to convert tab group ${groupId} to resource:`,
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
