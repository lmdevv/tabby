import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Browser } from "wxt/browser";
import { browser } from "wxt/browser";
import { SortableActiveTabCard } from "@/components/tabs/sortable-active-tab-card";
import { TabGroupHeader } from "@/components/tabs/tab-group-header";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { normalizeUrl } from "@/lib/resource-helpers";
import {
  findTabById,
  moveTabInBrowser,
  ungroupTabIfNeeded,
} from "@/lib/tab-helpers";

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
  // Focus management for vim keybindings
  const [focusedTabId, setFocusedTabId] = useState<number | null>(null);
  const [clipboardTabId, setClipboardTabId] = useState<number | null>(null);

  // Set up sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Handle drag end event
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !tabs) {
      return;
    }

    const draggedTab = findTabById(tabs, active.id as string);
    const targetTab = findTabById(tabs, over.id as string);

    if (!draggedTab?.id || !targetTab) return;

    const newIndex = tabs.findIndex((tab) => tab.id === targetTab.id);
    if (newIndex === -1) return;

    await ungroupTabIfNeeded(draggedTab);
    await moveTabInBrowser(draggedTab.id, newIndex);
  };

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
  const handleDeleteTab = useCallback(async (id: number) => {
    try {
      await browser.tabs.remove(id);
    } catch (error) {
      console.error("Failed to close tab:", error);
    }
  }, []);

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

  // Create sortable items array for SortableContext in visual order
  const sortableItems = useMemo(() => {
    return orderedElements
      .filter(
        (element): element is typeof element & { tab: { id: number } } =>
          (element.type === "tab" || element.type === "groupedTab") &&
          !!element.tab?.id,
      )
      .map((element) => element.tab.id.toString());
  }, [orderedElements]);

  // Get all navigable tabs in visual order for keyboard navigation
  const navigableTabs = useMemo(() => {
    return orderedElements
      .filter(
        (element): element is typeof element & { tab: { id: number } } =>
          (element.type === "tab" || element.type === "groupedTab") &&
          !!element.tab?.id,
      )
      .map((element) => element.tab);
  }, [orderedElements]);

  // Helper function to move tab after position of another tab
  const moveTabAfterPosition = useCallback(
    async (tabIdToMove: number, targetTabId: number) => {
      if (!tabs) return;

      const tabToMove = findTabById(tabs, tabIdToMove.toString());
      const targetTab = findTabById(tabs, targetTabId.toString());

      if (!tabToMove?.id || !targetTab) return;

      const targetIndex = tabs.findIndex((tab) => tab.id === targetTab.id);
      if (targetIndex === -1) return;

      // Move to position after target (targetIndex + 1)
      const newIndex = targetIndex + 1;

      await ungroupTabIfNeeded(tabToMove);
      await moveTabInBrowser(tabToMove.id, newIndex);
    },
    [tabs],
  );

  // Helper function to move tab before position of another tab
  const moveTabBeforePosition = useCallback(
    async (tabIdToMove: number, targetTabId: number) => {
      if (!tabs) return;

      const tabToMove = findTabById(tabs, tabIdToMove.toString());
      const targetTab = findTabById(tabs, targetTabId.toString());

      if (!tabToMove?.id || !targetTab) return;

      const targetIndex = tabs.findIndex((tab) => tab.id === targetTab.id);
      if (targetIndex === -1) return;

      // Move to position before target (targetIndex)
      const newIndex = targetIndex;

      await ungroupTabIfNeeded(tabToMove);
      await moveTabInBrowser(tabToMove.id, newIndex);
    },
    [tabs],
  );

  // Keyboard navigation and movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if we have tabs and no input is focused
      if (
        !navigableTabs.length ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const currentIndex = focusedTabId
        ? navigableTabs.findIndex((tab) => tab.id === focusedTabId)
        : -1;

      switch (e.key) {
        case "h": // Left
        case "ArrowLeft":
          e.preventDefault();
          if (currentIndex > 0 && navigableTabs[currentIndex - 1]?.id) {
            setFocusedTabId(navigableTabs[currentIndex - 1].id);
          }
          break;
        case "j": // Down
        case "ArrowDown":
          e.preventDefault();
          if (
            currentIndex < navigableTabs.length - 1 &&
            navigableTabs[currentIndex + 1]?.id
          ) {
            setFocusedTabId(navigableTabs[currentIndex + 1].id);
          }
          break;
        case "k": // Up
        case "ArrowUp":
          e.preventDefault();
          if (currentIndex > 0 && navigableTabs[currentIndex - 1]?.id) {
            setFocusedTabId(navigableTabs[currentIndex - 1].id);
          } else if (navigableTabs.length > 0 && navigableTabs[0]?.id) {
            setFocusedTabId(navigableTabs[0].id);
          }
          break;
        case "l": // Right
        case "ArrowRight":
          e.preventDefault();
          if (
            currentIndex < navigableTabs.length - 1 &&
            navigableTabs[currentIndex + 1]?.id
          ) {
            setFocusedTabId(navigableTabs[currentIndex + 1].id);
          }
          break;
        case "d": // dd for cut (vim style)
          if (e.key === "d" && !e.repeat) {
            // Wait for second 'd'
            let timeout: NodeJS.Timeout;
            const secondDHandler = (e2: KeyboardEvent) => {
              if (e2.key === "d") {
                e2.preventDefault();
                if (focusedTabId) {
                  const tabToCut = navigableTabs.find(
                    (tab) => tab.id === focusedTabId,
                  );
                  if (tabToCut) {
                    setClipboardTabId(focusedTabId);
                    // Move to next tab or previous
                    const nextIndex = Math.min(
                      currentIndex + 1,
                      navigableTabs.length - 1,
                    );
                    setFocusedTabId(navigableTabs[nextIndex]?.id || null);
                  }
                }
              }
              document.removeEventListener("keydown", secondDHandler);
              clearTimeout(timeout);
            };

            timeout = setTimeout(() => {
              document.removeEventListener("keydown", secondDHandler);
            }, 500);

            document.addEventListener("keydown", secondDHandler);
          }
          break;
        case "p": // p for paste after (move tab)
          e.preventDefault();
          if (
            clipboardTabId &&
            focusedTabId &&
            clipboardTabId !== focusedTabId
          ) {
            // Move clipboard tab after focused position
            moveTabAfterPosition(clipboardTabId, focusedTabId);
            setClipboardTabId(null);
          }
          break;
        case "P": // P for paste before (move tab)
          e.preventDefault();
          if (
            clipboardTabId &&
            focusedTabId &&
            clipboardTabId !== focusedTabId
          ) {
            // Move clipboard tab before focused position
            moveTabBeforePosition(clipboardTabId, focusedTabId);
            setClipboardTabId(null);
          }
          break;
        case "x": // x for delete focused tab
          e.preventDefault();
          if (focusedTabId) {
            // Calculate next focus position before deletion
            const currentIndex = navigableTabs.findIndex(
              (tab) => tab.id === focusedTabId,
            );
            let nextFocusId = null;

            if (navigableTabs.length > 1) {
              if (currentIndex === navigableTabs.length - 1) {
                // Last tab, move to previous
                nextFocusId = navigableTabs[currentIndex - 1]?.id || null;
              } else {
                // Not last tab, move to next
                nextFocusId = navigableTabs[currentIndex + 1]?.id || null;
              }
            }
            // If only one tab, focus will be cleared naturally when tabs update

            // Delete the tab
            handleDeleteTab(focusedTabId);

            // Set new focus immediately for better UX
            setFocusedTabId(nextFocusId);
          }
          break;
        case "Escape":
          setFocusedTabId(null);
          setClipboardTabId(null);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    navigableTabs,
    focusedTabId,
    clipboardTabId,
    moveTabAfterPosition,
    moveTabBeforePosition,
    handleDeleteTab,
  ]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortableItems}
        strategy={verticalListSortingStrategy}
      >
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

                if (
                  element.type === "groupedTab" &&
                  element.tab &&
                  element.group
                ) {
                  // Only render grouped tabs if the group is not collapsed
                  if (element.groupInfo?.collapsed) return null;

                  return (
                    <div key={`tab-${element.tab.id}`} className="ml-6">
                      {element.tab.id !== undefined && (
                        <SortableActiveTabCard
                          id={element.tab.id.toString()}
                          tabId={element.tab.id}
                          groupId={element.group?.groupId}
                          onClick={() => element.tab && onTabClick(element.tab)}
                          onDelete={handleDeleteTab}
                          onAddToResourceGroup={handleAddToResourceGroup}
                          isFocused={focusedTabId === element.tab.id}
                          isInClipboard={clipboardTabId === element.tab.id}
                        />
                      )}
                    </div>
                  );
                }

                if (element.type === "tab" && element.tab) {
                  return (
                    element.tab.id !== undefined && (
                      <SortableActiveTabCard
                        key={`tab-${element.tab.id}`}
                        id={element.tab.id.toString()}
                        tabId={element.tab.id}
                        onClick={() => element.tab && onTabClick(element.tab)}
                        onDelete={handleDeleteTab}
                        onAddToResourceGroup={handleAddToResourceGroup}
                        isFocused={focusedTabId === element.tab.id}
                        isInClipboard={clipboardTabId === element.tab.id}
                      />
                    )
                  );
                }

                return null;
              })}
            </div>
          </CardContent>
        </Card>
      </SortableContext>
    </DndContext>
  );
}
