import { db } from "@/lib/db/db";
import type { Resource, ResourceGroup } from "@/lib/types/types";

/**
 * Normalize URL for consistent comparison
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname.replace(/\/$/, "") + urlObj.search;
  } catch {
    // If URL parsing fails, fall back to basic normalization
    return url.toLowerCase().trim().replace(/\/$/, "");
  }
}

/**
 * Create a new resource group
 */
export async function createResourceGroup(
  name: string,
  description?: string,
): Promise<ResourceGroup> {
  return db.transaction("rw", db.resourceGroups, async () => {
    const timestamp = Date.now();
    const newGroup: Omit<ResourceGroup, "id"> = {
      name,
      description,
      collapsed: 0,
      resourceIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const id = await db.resourceGroups.add(newGroup);
    return { ...newGroup, id: id as number };
  });
}

/**
 * Update an existing resource group
 */
export async function updateResourceGroup(
  id: number,
  updates: Partial<Pick<ResourceGroup, "name" | "description" | "collapsed">>,
): Promise<void> {
  return db.transaction("rw", db.resourceGroups, async () => {
    await db.resourceGroups.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  });
}

/**
 * Delete a resource group and remove it from all workspaces
 */
export async function deleteResourceGroup(id: number): Promise<void> {
  return db.transaction(
    "rw",
    [db.resourceGroups, db.workspaces, db.resources],
    async () => {
      // First, check if the group exists
      const group = await db.resourceGroups.get(id);
      if (!group) {
        throw new Error(`Resource group with ID ${id} not found`);
      }

      // Get all resources in this group (handle undefined resourceIds)
      const resourceIds = group.resourceIds || [];
      const resourcesInGroup = await db.resources
        .filter((resource) => resourceIds.includes(resource.id.toString()))
        .toArray();

      // Delete all resources in this group
      for (const resource of resourcesInGroup) {
        await db.resources.delete(resource.id);
      }

      // Remove from all workspaces (handle undefined resourceGroupIds)
      await db.workspaces
        .filter((ws) => ws.resourceGroupIds?.includes(id))
        .modify((ws) => {
          ws.resourceGroupIds =
            ws.resourceGroupIds?.filter((rgId) => rgId !== id) || [];
        });

      // Finally delete the group
      await db.resourceGroups.delete(id);
    },
  );
}

/**
 * Create a new resource
 */
export async function createResource(
  data: Pick<Resource, "url" | "title" | "favIconUrl"> & {
    groupId: number;
    tags?: string[];
    description?: string;
  },
): Promise<Resource> {
  return db.transaction("rw", [db.resources, db.resourceGroups], async () => {
    const timestamp = Date.now();
    if (!data.url) {
      throw new Error("URL is required to create a resource");
    }

    const normalizedUrl = normalizeUrl(data.url);
    const normalizedTitle = (data.title || "Untitled").toLowerCase().trim();

    // Check for existing resource by title + URL match
    const allResources = await db.resources.toArray();
    const existingResource = allResources.find((resource) => {
      if (!resource.url) return false;
      const normalizedResourceUrl = normalizeUrl(resource.url);
      const normalizedResourceTitle = (resource.title || "Untitled")
        .toLowerCase()
        .trim();

      return (
        normalizedResourceUrl === normalizedUrl &&
        normalizedResourceTitle === normalizedTitle
      );
    });

    if (existingResource) {
      // Resource already exists, just add it to the group if not already there
      const group = await db.resourceGroups.get(data.groupId);
      if (!group) {
        throw new Error(`Resource group with ID ${data.groupId} not found`);
      }

      if (group.resourceIds.includes(existingResource.id.toString())) {
        throw new Error("Resource already exists in this group");
      }

      await db.resourceGroups.update(data.groupId, {
        resourceIds: [...group.resourceIds, existingResource.id.toString()],
        updatedAt: timestamp,
      });

      return existingResource;
    }

    const newResource: Omit<Resource, "id"> = {
      url: data.url,
      title: data.title,
      favIconUrl: data.favIconUrl,
      tags: data.tags,
      description: data.description,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Add the resource
    const id = await db.resources.add(newResource);

    // Get the current group to update its resourceIds
    const group = await db.resourceGroups.get(data.groupId);
    if (group) {
      const updatedResourceIds = [...(group.resourceIds || []), id.toString()];

      // Add resource ID to the group
      await db.resourceGroups.update(data.groupId, {
        resourceIds: updatedResourceIds,
        updatedAt: timestamp,
      });
    }

    return { ...newResource, id: id as number };
  });
}

/**
 * Update an existing resource
 */
export async function updateResource(
  id: number,
  updates: Partial<Pick<Resource, "title" | "tags" | "description">>,
): Promise<void> {
  return db.transaction("rw", db.resources, async () => {
    await db.resources.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  });
}

/**
 * Delete a resource and remove it from all groups (or just a specific group if groupId provided)
 */
export async function deleteResource(
  id: number,
  groupId?: number,
): Promise<void> {
  return db.transaction("rw", [db.resources, db.resourceGroups], async () => {
    if (groupId) {
      // Remove from specific group only
      const group = await db.resourceGroups.get(groupId);
      if (group?.resourceIds?.includes(id.toString())) {
        await db.resourceGroups.update(groupId, {
          resourceIds: group.resourceIds.filter(
            (resId) => resId !== id.toString(),
          ),
          updatedAt: Date.now(),
        });
      }
    } else {
      // Remove from all groups
      await db.resourceGroups
        .filter((group) => group.resourceIds?.includes(id.toString()))
        .modify((group) => {
          group.resourceIds =
            group.resourceIds?.filter((resId) => resId !== id.toString()) || [];
          group.updatedAt = Date.now();
        });

      // Then delete the resource entirely
      await db.resources.delete(id);
    }
  });
}

/**
 * Remove a resource from a specific group
 */
export async function removeResourceFromGroup(
  resourceId: number,
  groupId: number,
): Promise<void> {
  return db.transaction("rw", db.resourceGroups, async () => {
    const group = await db.resourceGroups.get(groupId);
    if (!group) {
      throw new Error(`Resource group with ID ${groupId} not found`);
    }

    // Check if resource exists in this group
    if (!group.resourceIds?.includes(resourceId.toString())) {
      throw new Error(`Resource ${resourceId} not found in group ${groupId}`);
    }

    // Remove resource from this specific group
    await db.resourceGroups.update(groupId, {
      resourceIds: group.resourceIds.filter(
        (id) => id !== resourceId.toString(),
      ),
      updatedAt: Date.now(),
    });
  });
}

/**
 * Move a resource from one group to another
 */
export async function moveResource(
  resourceId: number,
  fromGroupId: number,
  toGroupId: number,
): Promise<void> {
  return db.transaction("rw", db.resourceGroups, async () => {
    const timestamp = Date.now();

    // Remove from source group
    await db.resourceGroups.update(fromGroupId, (group) => {
      if (group) {
        group.resourceIds = group.resourceIds.filter(
          (id) => id !== resourceId.toString(),
        );
        group.updatedAt = timestamp;
      }
    });

    // Add to destination group
    await db.resourceGroups.update(toGroupId, (group) => {
      if (group && !group.resourceIds.includes(resourceId.toString())) {
        group.resourceIds = [...group.resourceIds, resourceId.toString()];
        group.updatedAt = timestamp;
      }
    });
  });
}

/**
 * Get all resource groups with their resources populated
 */
export async function getResourceGroupsWithResources(): Promise<
  (ResourceGroup & { resources: Resource[] })[]
> {
  const groups = await db.resourceGroups.toArray();
  const resources = await db.resources.toArray();

  return groups.map((group) => ({
    ...group,
    resources: resources.filter((resource) =>
      group.resourceIds.includes(resource.id.toString()),
    ),
  }));
}

/**
 * Convert a Tab to a Resource
 */
export function tabToResource(
  tab: Pick<Resource, "url" | "title" | "favIconUrl">,
): Omit<Resource, "id" | "createdAt" | "updatedAt"> {
  return {
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
  };
}

/**
 * Add multiple tabs to a resource group
 */
export async function addTabsToResourceGroup(
  tabs: Array<Pick<Resource, "url" | "title" | "favIconUrl">>,
  groupId: number,
): Promise<void> {
  return db.transaction("rw", [db.resources, db.resourceGroups], async () => {
    const timestamp = Date.now();

    // Get the current group to check existing resources
    const group = await db.resourceGroups.get(groupId);
    if (!group) {
      throw new Error(`Resource group with ID ${groupId} not found`);
    }

    const existingResourceIds = new Set(group.resourceIds || []);

    // Process each tab
    for (const tab of tabs) {
      if (!tab.url) continue; // Skip tabs without URLs

      const normalizedUrl = normalizeUrl(tab.url);
      const normalizedTitle = (tab.title || "Untitled").toLowerCase().trim();

      // Check for existing resource by title + URL match
      const allResources = await db.resources.toArray();
      const existingResource = allResources.find((resource) => {
        if (!resource.url) return false;
        const normalizedResourceUrl = normalizeUrl(resource.url);
        const normalizedResourceTitle = (resource.title || "Untitled")
          .toLowerCase()
          .trim();

        return (
          normalizedResourceUrl === normalizedUrl &&
          normalizedResourceTitle === normalizedTitle
        );
      });

      if (existingResource) {
        // Resource already exists, just add it to the group if not already there
        if (!existingResourceIds.has(existingResource.id.toString())) {
          existingResourceIds.add(existingResource.id.toString());
        }
      } else {
        // Create new resource
        const newResource: Omit<Resource, "id"> = {
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const id = await db.resources.add(newResource);
        existingResourceIds.add(id.toString());
      }
    }

    // Update the group with all the new resource IDs
    await db.resourceGroups.update(groupId, {
      resourceIds: Array.from(existingResourceIds),
      updatedAt: timestamp,
    });
  });
}
