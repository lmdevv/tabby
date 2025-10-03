import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import type { Browser } from "wxt/browser";
import { TabCard } from "@/components/tabs/tab-card";
import { TabGroupHeader } from "@/components/tabs/tab-group-header";
import { Card, CardContent } from "@/components/ui/card";

import { db } from "@/lib/db";
import { normalizeUrl } from "@/lib/resource-helpers";

import type { Tab } from "@/lib/types";

interface TabGroupInWindow {
  groupId: number;
  tabs: Tab[];
  collapsed: boolean;
}

interface WindowComponentProps {
  windowId: number;
  workspaceId: number;
  onTabClick: (tab: Tab) => void;
  onEditGroup: (groupId: number) => void;
}

export function WindowComponent({
  windowId,
  workspaceId,
  onTabClick,
  onEditGroup,
}: WindowComponentProps) {
  // Fetch data directly from DB
  const tabs = useLiveQuery(
    () =>
      db.activeTabs
        .where("workspaceId")
        .equals(workspaceId)
        .filter((tab) => tab.windowId === windowId)
        .sortBy("index"),
    [workspaceId, windowId],
  );

  const allTabGroups = useLiveQuery(
    () => db.tabGroups.where("workspaceId").equals(workspaceId).toArray(),
    [workspaceId],
  );

  // Action handlers
  const handleDeleteTab = async (id: number) => {
    try {
      await browser.tabs.remove(id);
    } catch (error) {
      console.error("Failed to close tab:", error);
    }
  };

  const handleAddToResourceGroup = async (tab: Tab, groupId: number) => {
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
          return;
        }

        await db.resourceGroups.update(groupId, {
          resourceIds: [...group.resourceIds, existingResource.id.toString()],
        });
      } else {
        // Create new resource and add to group
        const newResourceId = await db.resources.add({
          title: tab.title || "Untitled",
          url: tab.url,
          favIconUrl: tab.favIconUrl,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const group = await db.resourceGroups.get(groupId);
        if (!group) {
          throw new Error(`Resource group with ID ${groupId} not found`);
        }

        await db.resourceGroups.update(groupId, {
          resourceIds: [...group.resourceIds, newResourceId.toString()],
        });
      }
    } catch (error) {
      console.error("Failed to add tab to resource group:", error);
    }
  };

  const handleUngroupTabs = async (tabIds: number[]) => {
    try {
      if (typeof browser?.tabs?.ungroup === "function") {
        await browser.tabs.ungroup(tabIds as [number, ...number[]]);
      }
    } catch (error) {
      console.error("Failed to ungroup tabs:", error);
    }
  };

  const handleCloseTabs = async (tabIds: number[]) => {
    try {
      await browser.tabs.remove(tabIds);
    } catch (error) {
      console.error("Failed to close tabs:", error);
    }
  };

  // Create tabGroups from tabs and allTabGroups
  const tabGroups: TabGroupInWindow[] = useMemo(() => {
    if (!tabs || !allTabGroups) return [];

    const groupsMap = new Map<number, TabGroupInWindow>();

    // Group tabs by their groupId
    for (const tab of tabs) {
      if (tab.groupId && tab.groupId !== -1) {
        if (!groupsMap.has(tab.groupId)) {
          const groupInfo = allTabGroups.find((g) => g.id === tab.groupId);
          groupsMap.set(tab.groupId, {
            groupId: tab.groupId,
            tabs: [],
            collapsed: groupInfo?.collapsed ?? false,
          });
        }
        groupsMap.get(tab.groupId)?.tabs.push(tab);
      }
    }

    return Array.from(groupsMap.values());
  }, [tabs, allTabGroups]);

  // Create a map of which tabs belong to which group for quick lookup
  const tabToGroupMap = useMemo(() => {
    const map = new Map<number, TabGroupInWindow>();
    if (!tabGroups) return map;

    for (const group of tabGroups) {
      for (const tab of group.tabs) {
        if (tab.id !== undefined) {
          map.set(tab.id, group);
        }
      }
    }
    return map;
  }, [tabGroups]);

  // Create an ordered list of elements (tabs or group headers) as they should appear
  const orderedElements: Array<{
    type: "tab" | "groupHeader" | "groupedTab";
    tab?: Tab;
    group?: TabGroupInWindow;
    groupInfo?: Browser.tabGroups.TabGroup;
  }> = useMemo(() => {
    if (!tabs || !allTabGroups) return [];

    const getTabGroupInfo = (groupId?: number) => {
      if (!groupId) return undefined;
      return allTabGroups.find((group) => group.id === groupId);
    };

    const elements: typeof orderedElements = [];
    const processedGroups = new Set<number>();

    // Process tabs in their browser order
    for (const tab of tabs) {
      if (tab.groupId && tab.groupId !== -1) {
        // This tab is part of a group
        if (!processedGroups.has(tab.groupId)) {
          // First time we encounter this group, add the group header
          const group =
            tab.id !== undefined ? tabToGroupMap.get(tab.id) : undefined;
          if (group) {
            const groupInfo = getTabGroupInfo(tab.groupId);
            const finalGroupInfo = groupInfo || {
              id: tab.groupId,
              title: `Tab Group ${tab.groupId}`,
              color: "grey" as const,
              collapsed: group.collapsed,
              windowId: windowId,
              shared: false,
            };

            elements.push({
              type: "groupHeader",
              group,
              groupInfo: finalGroupInfo,
            });
            processedGroups.add(tab.groupId);

            // Add all tabs in this group
            for (const groupTab of group.tabs) {
              elements.push({
                type: "groupedTab",
                tab: groupTab,
                group,
                groupInfo: finalGroupInfo,
              });
            }
          }
        }
        // Skip individual grouped tabs as they're added with their group
      } else {
        // Ungrouped tab
        elements.push({
          type: "tab",
          tab,
        });
      }
    }

    return elements;
  }, [tabs, allTabGroups, tabToGroupMap, windowId]);

  return (
    <Card className="mx-auto w-full [max-width:min(1200px,92vw)] gap-0 border py-0 shadow-sm flex flex-col min-h-[220px] m-1">
      <CardContent className="p-0 flex-1">
        <div className="space-y-1 p-3">
          {orderedElements.map((element, _index) => {
            if (
              element.type === "groupHeader" &&
              element.group &&
              element.groupInfo
            ) {
              return (
                <div key={`group-${element.group.groupId}`}>
                  <TabGroupHeader
                    groupId={element.group.groupId}
                    onEditGroup={() =>
                      element.group?.groupId !== undefined &&
                      onEditGroup(element.group.groupId)
                    }
                    onUngroupAll={() =>
                      element.group?.tabs &&
                      handleUngroupTabs(
                        element.group.tabs
                          .map((tab) => tab.id)
                          .filter((id): id is number => id !== undefined),
                      )
                    }
                    onCloseAll={() =>
                      element.group?.tabs &&
                      handleCloseTabs(
                        element.group.tabs
                          .map((tab) => tab.id)
                          .filter((id): id is number => id !== undefined),
                      )
                    }
                  />
                </div>
              );
            }

            if (element.type === "groupedTab" && element.tab && element.group) {
              // Only render grouped tabs if the group is not collapsed
              if (element.groupInfo?.collapsed) return null;

              return (
                <div key={`tab-${element.tab.id}`} className="ml-6">
                  {element.tab.id !== undefined && (
                    <TabCard
                      tabId={element.tab.id}
                      groupId={element.group?.groupId}
                      onClick={() => element.tab && onTabClick(element.tab)}
                      onDelete={handleDeleteTab}
                      onAddToResourceGroup={handleAddToResourceGroup}
                    />
                  )}
                </div>
              );
            }

            if (element.type === "tab" && element.tab) {
              return (
                element.tab.id !== undefined && (
                  <TabCard
                    key={`tab-${element.tab.id}`}
                    tabId={element.tab.id}
                    onClick={() => element.tab && onTabClick(element.tab)}
                    onDelete={handleDeleteTab}
                    onAddToResourceGroup={handleAddToResourceGroup}
                  />
                )
              );
            }

            return null;
          })}
        </div>
      </CardContent>
    </Card>
  );
}
