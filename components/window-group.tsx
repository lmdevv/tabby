"use client";

import { Monitor } from "lucide-react";
import type { Tab, TabGroup } from "@/lib/types";
import { TabCard } from "./tab-card";
import { TabGroupHeader } from "./tab-group-header";

interface TabGroupInWindow {
  groupId: number;
  tabs: Tab[];
  collapsed: boolean;
}

interface WindowGroupProps {
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
}

export function WindowGroup({
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
  onPinTab,
  onMuteTab,
  onHighlightTab,
  onSelectTab,
  onToggleGroupCollapse,
  onEditGroup,
  onUngroupTabs,
  onCloseTabs,
}: WindowGroupProps) {
  const getTabGroupInfo = (groupId?: number) => {
    if (!groupId) return undefined;
    return allTabGroups.find((group) => group.id === groupId);
  };

  return (
    <div className="flex flex-col">
      {/* Window header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur-sm">
        <Monitor className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-medium text-sm">Window {windowIndex + 1}</h2>
        <span className="ml-1 text-muted-foreground text-xs">
          ({tabs.length} tabs)
        </span>
      </div>

      {/* Tabs in this window */}
      <div className="flex flex-col gap-1.5 p-2">
        {/* First show tabs that don't belong to any group */}
        {tabs
          .filter((tab) => !tab.groupId)
          .map((tab) => (
            <TabCard
              key={tab.id}
              tab={tab}
              onClick={() => onTabClick(tab)}
              onDelete={onDeleteTab}
              onPin={onPinTab}
              onMute={onMuteTab}
              onHighlight={onHighlightTab}
              showTags={showTags}
              showUrl={showUrls}
              isSelected={selectedTabs.includes(tab.id)}
              onSelectChange={onSelectTab}
              tabGroup={undefined}
            />
          ))}

        {/* Then show tabs organized by groups */}
        {tabGroups.map((tabGroup) => {
          const groupInfo = getTabGroupInfo(tabGroup.groupId);
          if (!groupInfo) return null;

          return (
            <div key={tabGroup.groupId} className="mb-2">
              {/* Group header */}
              <TabGroupHeader
                groupInfo={groupInfo}
                tabCount={tabGroup.tabs.length}
                collapsed={groupInfo.collapsed}
                onToggleCollapse={() =>
                  onToggleGroupCollapse(windowId, tabGroup.groupId)
                }
                onEditGroup={() => onEditGroup(tabGroup.groupId)}
                onUngroupAll={() =>
                  onUngroupTabs(tabGroup.tabs.map((tab) => tab.id))
                }
                onCloseAll={() =>
                  onCloseTabs(tabGroup.tabs.map((tab) => tab.id))
                }
              />

              {/* Group tabs */}
              {!groupInfo.collapsed && (
                <div className="mt-1 space-y-1 pl-6">
                  {tabGroup.tabs.map((tab) => (
                    <TabCard
                      key={tab.id}
                      tab={tab}
                      onClick={() => onTabClick(tab)}
                      onDelete={onDeleteTab}
                      onPin={onPinTab}
                      onMute={onMuteTab}
                      onHighlight={onHighlightTab}
                      showTags={showTags}
                      showUrl={showUrls}
                      isSelected={selectedTabs.includes(tab.id)}
                      onSelectChange={onSelectTab}
                      tabGroup={{
                        name: groupInfo.name,
                        color: groupInfo.color,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
