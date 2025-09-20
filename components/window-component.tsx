import { Maximize2, Minimize2, Monitor, X } from "lucide-react";
import type { Browser } from "wxt/browser";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { browserColorToHex } from "@/lib/tab-group-colors";
import type { Tab } from "@/lib/types";
import { TabCard } from "./tab-card";
import { TabGroupHeader } from "./tab-group-header";

type TabGroup = Browser.tabGroups.TabGroup;

interface TabGroupInWindow {
  groupId: number;
  tabs: Tab[];
  collapsed: boolean;
}

interface WindowComponentProps {
  windowId: number;
  windowIndex: number;
  tabs: Tab[];
  tabGroups: TabGroupInWindow[];
  allTabGroups: TabGroup[];
  selectedTabs: number[];
  showTags: boolean;
  showUrls: boolean;
  onTabClick: (tab: Tab) => void;
  onDeleteTab: (id: number) => void;
  onPinTab: (id: number, pinned: boolean) => void;
  onMuteTab: (id: number, muted: boolean) => void;
  onHighlightTab: (id: number, highlighted: boolean) => void;
  onSelectTab: (id: number, selected: boolean) => void;
  onToggleGroupCollapse: (windowId: number, groupId: number) => void;
  onEditGroup: (groupId: number) => void;
  onUngroupTabs: (tabIds: number[]) => void;
  onCloseTabs: (tabIds: number[]) => void;
  minimized?: boolean;
  onToggleMinimize?: (windowId: number) => void;
}

export function WindowComponent({
  windowId,
  windowIndex,
  tabs,
  tabGroups,
  allTabGroups,
  selectedTabs,
  showTags,
  showUrls,
  onTabClick,
  onDeleteTab,
  onPinTab: _onPinTab,
  onMuteTab,
  onHighlightTab,
  onSelectTab,
  onToggleGroupCollapse,
  onEditGroup,
  onUngroupTabs,
  onCloseTabs,
  minimized = false,
  onToggleMinimize = () => {},
}: WindowComponentProps) {
  const getTabGroupInfo = (groupId?: number) => {
    if (!groupId) return undefined;
    return allTabGroups.find((group) => group.id === groupId);
  };

  // Create a map of which tabs belong to which group for quick lookup
  const tabToGroupMap = new Map<number, TabGroupInWindow>();
  for (const group of tabGroups) {
    for (const tab of group.tabs) {
      if (tab.id !== undefined) {
        tabToGroupMap.set(tab.id, group);
      }
    }
  }

  // Create an ordered list of elements (tabs or group headers) as they should appear
  const orderedElements: Array<{
    type: "tab" | "groupHeader" | "groupedTab";
    tab?: Tab;
    group?: TabGroupInWindow;
    groupInfo?: Browser.tabGroups.TabGroup;
  }> = [];

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
          };

          orderedElements.push({
            type: "groupHeader",
            group,
            groupInfo: finalGroupInfo,
          });
          processedGroups.add(tab.groupId);

          // Add all tabs in this group
          for (const groupTab of group.tabs) {
            orderedElements.push({
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
      orderedElements.push({
        type: "tab",
        tab,
      });
    }
  }

  return (
    <Card className="mx-auto w-full [max-width:min(1200px,92vw)] gap-0 overflow-hidden border py-0 shadow-sm flex flex-col max-h-[70vh] min-h-[220px]">
      <CardHeader className="m-0 flex flex-row items-center justify-between border-b bg-muted/50 px-4 pt-3 pb-0">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium text-sm">Window {windowIndex + 1}</h2>
          <span className="ml-1 text-muted-foreground text-xs">
            ({tabs.length} tabs)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onToggleMinimize(windowId)}
            className="rounded-sm p-1 hover:bg-accent/50"
            title={minimized ? "Expand window" : "Minimize window"}
          >
            {minimized ? (
              <Maximize2 className="h-3 w-3" />
            ) : (
              <Minimize2 className="h-3 w-3" />
            )}
          </button>
          <button
            type="button"
            onClick={() =>
              onCloseTabs(
                tabs
                  .map((tab) => tab.id)
                  .filter((id): id is number => id !== undefined),
              )
            }
            className="rounded-sm p-1 hover:bg-accent/50"
            title="Close all tabs in window"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </CardHeader>

      {!minimized && (
        <CardContent className="p-0 flex-1 overflow-y-auto scrollbar-none">
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

              if (
                element.type === "groupedTab" &&
                element.tab &&
                element.group
              ) {
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
                      showTags={showTags}
                      showUrl={showUrls}
                      isSelected={
                        element.tab.id !== undefined &&
                        selectedTabs.includes(element.tab.id)
                      }
                      onSelectChange={onSelectTab}
                      tabGroup={{
                        name: element.groupInfo?.title || "Untitled",
                        color: (
                          element.groupInfo?.color as string
                        )?.startsWith?.("#")
                          ? (element.groupInfo?.color as string)
                          : browserColorToHex(
                              element.groupInfo
                                ?.color as Browser.tabGroups.ColorEnum,
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
                    showTags={showTags}
                    showUrl={showUrls}
                    isSelected={
                      element.tab.id !== undefined &&
                      selectedTabs.includes(element.tab.id)
                    }
                    onSelectChange={onSelectTab}
                    tabGroup={undefined}
                  />
                );
              }

              return null;
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
