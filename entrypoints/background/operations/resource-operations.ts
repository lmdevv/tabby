import { browser } from "wxt/browser";
import { db } from "@/lib/db/db";

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
    const resourceGroupId = await db.resourceGroups.add({
      // id will be auto-assigned by Dexie
      name: tabGroup.title || "Converted Tab Group",
      collapsed: 0 as const,
      resourceIds: [] as string[],
      createdAt: timestamp,
      updatedAt: timestamp,
    } as Omit<import("@/lib/types/types").ResourceGroup, "id">);

    // Create resources from tabs
    const resourceIds: string[] = [];
    for (const tab of tabsInGroup) {
      if (!tab.url) continue;

      const newId = await db.resources.add({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        tags: tab.tags,
        description: tab.description,
        createdAt: timestamp,
        updatedAt: timestamp,
      } as Omit<import("@/lib/types/types").Resource, "id">);

      resourceIds.push(String(newId));
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
