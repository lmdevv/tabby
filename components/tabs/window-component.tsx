import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import type { Browser } from "wxt/browser";
import { TabCard } from "@/components/tabs/tab-card";
import { TabGroupHeader } from "@/components/tabs/tab-group-header";
import { Card, CardContent } from "@/components/ui/card";
import { useResourceGroups } from "@/hooks/use-resources";
import { useAppState, useUpdateState } from "@/hooks/use-state";
import { db } from "@/lib/db";
import { browserColorToHex } from "@/lib/tab-group-colors";
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
  onDeleteTab: (id: number) => void;
  onPinTab?: (id: number, pinned: boolean) => void;
  onMuteTab: (id: number, muted: boolean) => void;
  onHighlightTab: (id: number, highlighted: boolean) => void;
  onAddToResourceGroup?: (tab: Tab, groupId: number) => void;
  onToggleGroupCollapse: (windowId: number, groupId: number) => void;
  onEditGroup: (groupId: number) => void;
  onUngroupTabs: (tabIds: number[]) => void;
  onCloseTabs: (tabIds: number[]) => void;
}

export function WindowComponent({
  windowId,
  workspaceId,
  onTabClick,
  onDeleteTab,
  onPinTab: _onPinTab,
  onMuteTab,
  onHighlightTab,
  onAddToResourceGroup,
  onToggleGroupCollapse,
  onEditGroup,
  onUngroupTabs,
  onCloseTabs,
}: WindowComponentProps) {
  // Fetch data directly from DB
  const tabs = useLiveQuery(
    () =>
      db.activeTabs
        .where("workspaceId")
        .equals(workspaceId)
        .filter((tab) => tab.windowId === windowId)
        .toArray(),
    [workspaceId, windowId],
  );

  const allTabGroups = useLiveQuery(
    () => db.tabGroups.where("workspaceId").equals(workspaceId).toArray(),
    [workspaceId],
  );

  const resourceGroups = useResourceGroups();

  // UI state using global state
  const { data: showTagsData } = useAppState("showTags");
  const { data: showUrlsData } = useAppState("showUrls");
  const { data: selectedTabs } = useAppState("selectedTabs");
  const { updateState } = useUpdateState();

  const showTags = (showTagsData as boolean) ?? true;
  const showUrls = (showUrlsData as boolean) ?? true;
  const currentSelectedTabs = (selectedTabs as number[]) ?? [];
  const handleSelectTab = (id: number, selected: boolean) => {
    const newSelectedTabs = selected
      ? [...currentSelectedTabs, id]
      : currentSelectedTabs.filter((tabId: number) => tabId !== id);
    updateState("selectedTabs", newSelectedTabs);
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
                    groupInfo={element.groupInfo}
                    tabCount={element.group.tabs.length}
                    collapsed={element.groupInfo.collapsed}
                    onToggleCollapse={() =>
                      element.group?.groupId !== undefined &&
                      onToggleGroupCollapse(windowId, element.group.groupId)
                    }
                    onEditGroup={() =>
                      element.group?.groupId !== undefined &&
                      onEditGroup(element.group.groupId)
                    }
                    onUngroupAll={() =>
                      element.group?.tabs &&
                      onUngroupTabs(
                        element.group.tabs
                          .map((tab) => tab.id)
                          .filter((id): id is number => id !== undefined),
                      )
                    }
                    onCloseAll={() =>
                      element.group?.tabs &&
                      onCloseTabs(
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
                  <TabCard
                    tab={element.tab}
                    onClick={() => element.tab && onTabClick(element.tab)}
                    onDelete={onDeleteTab}
                    onMute={onMuteTab}
                    onHighlight={onHighlightTab}
                    onAddToResourceGroup={onAddToResourceGroup}
                    resourceGroups={resourceGroups}
                    showTags={showTags}
                    showUrl={showUrls}
                    isSelected={
                      element.tab.id !== undefined &&
                      currentSelectedTabs.includes(element.tab.id)
                    }
                    onSelectChange={handleSelectTab}
                    tabGroup={{
                      name: element.groupInfo?.title || "Untitled",
                      color: (element.groupInfo?.color as string)?.startsWith?.(
                        "#",
                      )
                        ? (element.groupInfo?.color as string)
                        : browserColorToHex(
                            element.groupInfo
                              ?.color as `${Browser.tabGroups.Color}`,
                          ),
                    }}
                  />
                </div>
              );
            }

            if (element.type === "tab" && element.tab) {
              return (
                <TabCard
                  key={`tab-${element.tab.id}`}
                  tab={element.tab}
                  onClick={() => element.tab && onTabClick(element.tab)}
                  onDelete={onDeleteTab}
                  onMute={onMuteTab}
                  onHighlight={onHighlightTab}
                  onAddToResourceGroup={onAddToResourceGroup}
                  resourceGroups={resourceGroups}
                  showTags={showTags}
                  showUrl={showUrls}
                  isSelected={
                    element.tab.id !== undefined &&
                    currentSelectedTabs.includes(element.tab.id)
                  }
                  onSelectChange={handleSelectTab}
                  tabGroup={undefined}
                />
              );
            }

            return null;
          })}
        </div>
      </CardContent>
    </Card>
  );
}
