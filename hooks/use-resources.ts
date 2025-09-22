import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { createResource, normalizeUrl } from "@/lib/resource-helpers";
import type { Resource, ResourceGroup, Tab } from "@/lib/types";

export interface EnrichedResourceGroup extends ResourceGroup {
  resources: Resource[];
}

/**
 * Hook to get all resource groups with their resources populated
 */
export function useResourceGroups(): EnrichedResourceGroup[] | undefined {
  return useLiveQuery(async () => {
    const groups = await db.resourceGroups.toArray();
    const resources = await db.resources.toArray();

    return groups.map(
      (group): EnrichedResourceGroup => ({
        ...group,
        resources: resources.filter((resource) =>
          group.resourceIds.includes(resource.id.toString()),
        ),
      }),
    );
  }, []);
}

/**
 * Hook to get a specific resource group with its resources
 */
export function useResourceGroup(groupId: number) {
  return useLiveQuery(async () => {
    const group = await db.resourceGroups.get(groupId);
    if (!group) return null;

    const resources = await db.resources
      .filter((resource) => group.resourceIds.includes(resource.id.toString()))
      .toArray();

    return {
      ...group,
      resources,
    };
  }, [groupId]);
}

/**
 * Hook to get all resources
 */
export function useResources() {
  return useLiveQuery(() => db.resources.toArray(), []);
}

/**
 * Hook to get a specific resource
 */
export function useResource(resourceId: number) {
  return useLiveQuery(() => db.resources.get(resourceId), [resourceId]);
}

/**
 * Hook to check if a tab is already a resource (by title/URL comparison)
 * Uses efficient database queries instead of fetching all data
 */
export function useTabIsResource() {
  const resources = useResources();
  const resourceGroups = useResourceGroups();

  // Pre-compute normalized data for efficient lookups
  const normalizedResourceMap = useLiveQuery(async () => {
    const resources = await db.resources.toArray();
    const map = new Map<string, Resource[]>();

    resources.forEach((resource) => {
      if (resource.url) {
        const normalizedUrl = normalizeUrl(resource.url);
        const normalizedTitle = (resource.title || "Untitled")
          .toLowerCase()
          .trim();
        const key = `${normalizedUrl}|${normalizedTitle}`;

        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)?.push(resource);
      }
    });

    return map;
  }, []);

  const checkTabIsResource = (tab: Pick<Resource, "title" | "url">) => {
    if (!normalizedResourceMap || !tab.url || !tab.title) return false;

    const normalizedTabUrl = normalizeUrl(tab.url);
    const normalizedTabTitle = tab.title.toLowerCase().trim();
    const key = `${normalizedTabUrl}|${normalizedTabTitle}`;

    return normalizedResourceMap.has(key);
  };

  const getResourceGroupsForTab = (tab: Pick<Resource, "title" | "url">) => {
    if (!resources || !resourceGroups || !tab.url || !tab.title) return [];

    const normalizedTabUrl = normalizeUrl(tab.url);
    const normalizedTabTitle = tab.title.toLowerCase().trim();

    const matchingResources = resources.filter((resource) => {
      if (!resource.url) return false;
      const normalizedResourceUrl = normalizeUrl(resource.url);
      const normalizedResourceTitle = (resource.title || "Untitled")
        .toLowerCase()
        .trim();

      return (
        normalizedResourceUrl === normalizedTabUrl &&
        normalizedResourceTitle === normalizedTabTitle
      );
    });

    const matchingResourceIds = matchingResources.map((r) => r.id.toString());
    return resourceGroups.filter((group: ResourceGroup) =>
      group.resourceIds.some((id: string) => matchingResourceIds.includes(id)),
    );
  };

  return { checkTabIsResource, getResourceGroupsForTab };
}

/**
 * Hook for adding a tab to a resource group
 */
export function useAddTabToResourceGroup() {
  const addTabToResourceGroup = async (
    tab: Pick<Tab, "title" | "url" | "favIconUrl">,
    groupId: number,
  ) => {
    try {
      // Check if resource already exists
      if (!tab.url) {
        throw new Error("URL is required to create a resource");
      }

      const normalizedTabUrl = normalizeUrl(tab.url);
      const normalizedTabTitle = (tab.title || "Untitled").toLowerCase().trim();

      // Find existing resource by title + URL match
      const allResources = await db.resources.toArray();
      const existingResource = allResources.find((resource) => {
        if (!resource.url) return false;
        const normalizedResourceUrl = normalizeUrl(resource.url);
        const normalizedResourceTitle = (resource.title || "Untitled")
          .toLowerCase()
          .trim();

        return (
          normalizedResourceUrl === normalizedTabUrl &&
          normalizedResourceTitle === normalizedTabTitle
        );
      });

      if (existingResource) {
        console.log(
          "Resource already exists, adding to group:",
          existingResource.id,
        );
        // Resource already exists, just add it to the group if not already there
        const group = await db.resourceGroups.get(groupId);
        if (!group) {
          throw new Error(`Resource group with ID ${groupId} not found`);
        }

        if (group.resourceIds.includes(existingResource.id.toString())) {
          console.log("Resource already in group");
          toast.success("Resource already in group");
          return existingResource;
        }

        await db.resourceGroups.update(groupId, {
          resourceIds: [...group.resourceIds, existingResource.id.toString()],
          updatedAt: Date.now(),
        });
        console.log("Successfully added existing resource to group");
        toast.success("Resource added to group successfully");
        return existingResource;
      }

      // Create new resource
      console.log("Creating new resource for URL:", tab.url);
      const newResource = await createResource({
        title: tab.title || "Untitled",
        url: tab.url,
        favIconUrl: tab.favIconUrl,
        groupId,
      });
      console.log("Successfully created new resource:", newResource.id);
      toast.success("Tab added to resource group successfully");
      return newResource;
    } catch (error) {
      console.error("Failed to add tab to resource group:", error);
      toast.error("Failed to add tab to resource group");
      throw error;
    }
  };

  return { addTabToResourceGroup };
}
