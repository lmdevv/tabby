import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { toast } from "sonner";
import { browser } from "wxt/browser";
import { ResourcesPanel } from "@/components/resources/resources-panel";
import { WindowComponent } from "@/components/tabs/window-component";
import { TopToolbar } from "@/components/toolbar/top-toolbar";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EnrichedResourceGroup } from "@/hooks/use-resources";
import { useState, useUpdateState } from "@/hooks/use-state";
import { db } from "@/lib/db";
import type { Tab } from "@/lib/types";

interface WindowGroupData {
  windowId: number;
  tabs: Tab[];
  tabGroups: Array<{
    groupId: number;
    tabs: Tab[];
    collapsed: boolean;
  }>;
  minimized: boolean;
}

interface AppContentProps {
  previewWorkspaceId: number | null;
  shownWorkspaceId: number | null;
  selectedTabs: number[];
  setSelectedTabs: (tabs: number[] | ((prev: number[]) => number[])) => void;
  onTabClick: (tab: Tab) => Promise<void>;
  onDeleteTab: (id: number) => Promise<void>;
  onMuteTab: (id: number, muted: boolean) => Promise<void>;
  onHighlightTab: (id: number, highlighted: boolean) => Promise<void>;
  onAddToResourceGroup: (tab: Tab, groupId: number) => Promise<void>;
  onToggleGroupCollapse: (windowId: number, groupId: number) => Promise<void>;
  onEditGroup: (groupId: number) => Promise<void>;
  onUngroupTabs: (tabIds: number[]) => Promise<void>;
  onCloseTabs: (tabIds: number[]) => Promise<void>;
  onHistory: () => void;
}

export function AppContent({
  previewWorkspaceId: _previewWorkspaceId,
  shownWorkspaceId,
  selectedTabs,
  setSelectedTabs,
  onTabClick,
  onDeleteTab,
  onMuteTab,
  onHighlightTab,
  onAddToResourceGroup,
  onToggleGroupCollapse,
  onEditGroup,
  onUngroupTabs,
  onCloseTabs,
  onHistory,
}: AppContentProps) {
  // Get settings directly in the component
  const { data: showTagsData } = useState("showTags");
  const { data: showUrlsData } = useState("showUrls");
  const { data: showResourcesData } = useState("showResources");
  const { updateState } = useUpdateState();

  const showTags = (showTagsData ?? true) as boolean;
  const showUrls = (showUrlsData ?? true) as boolean;
  const showResources = (showResourcesData ?? true) as boolean;

  // Toggle handlers
  const toggleShowTags = () => updateState("showTags", !showTags);
  const toggleShowUrls = () => updateState("showUrls", !showUrls);

  // Get tabs data directly using Dexie
  const shownTabs = useLiveQuery(() => {
    if (!shownWorkspaceId) return [];
    return db.activeTabs
      .where("workspaceId")
      .equals(shownWorkspaceId)
      .toArray();
  }, [shownWorkspaceId]);

  // Get tab groups data directly using Dexie
  const tabGroups = useLiveQuery(() => {
    if (!shownWorkspaceId) return [];
    return db.tabGroups.where("workspaceId").equals(shownWorkspaceId).toArray();
  }, [shownWorkspaceId]);

  // Get resource groups and resources data directly using Dexie
  const resourceGroups = useLiveQuery(() => {
    return db.resourceGroups.toArray();
  }, []);

  const resources = useLiveQuery(() => {
    return db.resources.toArray();
  }, []);

  // Convert ResourceGroup[] to EnrichedResourceGroup[]
  const enrichedResourceGroups: EnrichedResourceGroup[] | undefined =
    useMemo(() => {
      if (!resourceGroups || !resources) return undefined;

      return resourceGroups.map((group) => ({
        ...group,
        resources: resources.filter((resource) =>
          group.resourceIds.includes(resource.id.toString()),
        ),
      }));
    }, [resourceGroups, resources]);

  // Get active tabs for resource status indicators
  const activeTabs = useLiveQuery(async () => {
    if (!shownWorkspaceId) return [];
    return db.activeTabs
      .where("workspaceId")
      .equals(shownWorkspaceId)
      .toArray();
  }, [shownWorkspaceId]);

  // Create window groups (this logic stays here since it's complex)
  const windowGroups: WindowGroupData[] = useMemo(() => {
    if (!shownTabs?.length) return [];

    // Group tabs by window first
    const tabsByWindow = shownTabs.reduce(
      (windows, tab) => {
        if (!windows[tab.windowId]) {
          windows[tab.windowId] = [];
        }
        windows[tab.windowId].push(tab);
        return windows;
      },
      {} as Record<number, Tab[]>,
    );

    return Object.entries(tabsByWindow)
      .map(([windowIdStr, tabs]) => {
        const windowId = Number(windowIdStr);

        // Sort tabs by their index to maintain browser order
        const sortedTabs = tabs.sort((a, b) => a.index - b.index);

        // Create tab groups while preserving order
        const windowTabGroups: WindowGroupData["tabGroups"] = [];
        const processedGroupIds = new Set<number>();

        // Find all unique group IDs in this window
        for (const tab of sortedTabs) {
          if (
            tab.groupId &&
            tab.groupId !== -1 &&
            !processedGroupIds.has(tab.groupId)
          ) {
            processedGroupIds.add(tab.groupId);

            const groupTabs = sortedTabs.filter(
              (t) => t.groupId === tab.groupId,
            );
            const groupInfo = tabGroups?.find((g) => g.id === tab.groupId);

            windowTabGroups.push({
              groupId: tab.groupId,
              tabs: groupTabs,
              collapsed: groupInfo?.collapsed || false,
            });
          }
        }

        return {
          windowId,
          tabs: sortedTabs,
          tabGroups: windowTabGroups,
          minimized: false, // This was unused in original code
        };
      })
      .sort((a, b) => a.windowId - b.windowId);
  }, [shownTabs, tabGroups]);

  // Toolbar handlers
  const handleRefresh = async (): Promise<void> => {
    try {
      await browser.runtime.sendMessage({ type: "refreshTabs" });
      toast.success("Tabs refreshed successfully");
    } catch (error) {
      console.error("Failed to refresh tabs:", error);
      toast.error("Failed to refresh tabs");
    }
  };

  const handleSortTabs = async (
    windowId: number,
    sortType: "title" | "domain" | "recency",
  ) => {
    try {
      await browser.runtime.sendMessage({
        type: "sortTabs",
        windowId,
        sortType,
      } as const);
      toast.success("Tabs sorted successfully");
    } catch (error) {
      console.error("Failed to sort tabs:", error);
      toast.error("Failed to sort tabs");
    }
  };

  const handleGroupTabsByDomain = async (windowId: number) => {
    try {
      await browser.runtime.sendMessage({
        type: "groupTabs",
        windowId,
        groupType: "domain",
      } as const);
      toast.success("Tabs grouped successfully");
    } catch (error) {
      console.error("Failed to group tabs:", error);
      toast.error("Failed to group tabs");
    }
  };

  const handleSelectAll = () => {
    if (!shownTabs?.length) return;
    const allTabIds = shownTabs
      .map((tab) => tab.id)
      .filter((id): id is number => id !== undefined);
    setSelectedTabs(selectedTabs.length === allTabIds.length ? [] : allTabIds);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex-1 h-full">
        {showResources ? (
          /* Split Layout - Both panels */
          <div className="grid grid-cols-2 gap-4 h-full">
            {/* Active Tabs Panel */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">Active Tabs</h2>
              </div>
              {windowGroups.length > 0 ? (
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[calc(100vh-140px)] scrollbar-none">
                    <div className="space-y-6 px-6 py-2">
                      {windowGroups.map((windowGroup) => {
                        return (
                          <div key={windowGroup.windowId}>
                            {/* Per-window toolbar */}
                            <div className="flex items-center justify-end mb-2">
                              <TopToolbar
                                showTags={showTags}
                                onToggleShowTags={toggleShowTags}
                                showUrls={showUrls}
                                onToggleShowUrls={toggleShowUrls}
                                selectedTabsCount={selectedTabs.length}
                                tabsCount={windowGroup.tabs.length}
                                onSelectAll={handleSelectAll}
                                onRefresh={handleRefresh}
                                onHistory={onHistory}
                                onSortTabs={(sortType) =>
                                  handleSortTabs(windowGroup.windowId, sortType)
                                }
                                onGroupTabs={(_groupType) =>
                                  handleGroupTabsByDomain(windowGroup.windowId)
                                }
                              />
                            </div>
                            <WindowComponent
                              windowId={windowGroup.windowId}
                              tabs={windowGroup.tabs}
                              tabGroups={windowGroup.tabGroups}
                              allTabGroups={tabGroups || []}
                              selectedTabs={selectedTabs}
                              showTags={showTags}
                              showUrls={showUrls}
                              resourceGroups={enrichedResourceGroups}
                              onTabClick={onTabClick}
                              onDeleteTab={onDeleteTab}
                              onPinTab={() => {}}
                              onMuteTab={onMuteTab}
                              onHighlightTab={onHighlightTab}
                              onAddToResourceGroup={onAddToResourceGroup}
                              onSelectTab={(id, selected) =>
                                setSelectedTabs((prev) =>
                                  selected
                                    ? [...prev, id]
                                    : prev.filter((tabId) => tabId !== id),
                                )
                              }
                              onToggleGroupCollapse={onToggleGroupCollapse}
                              onEditGroup={onEditGroup}
                              onUngroupTabs={onUngroupTabs}
                              onCloseTabs={onCloseTabs}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <h2 className="font-semibold text-2xl">No Tabs</h2>
                    <p className="mt-2 text-muted-foreground">
                      Select a workspace from the sidebar to view its tabs
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Resources Panel */}
            <div className="flex flex-col">
              <div className="flex-1">
                <ResourcesPanel
                  resourceGroups={enrichedResourceGroups}
                  resources={resources}
                  showTags={showTags}
                  showUrls={showUrls}
                  activeTabs={activeTabs || []}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Single Layout - Only active tabs, centered */
          <div className="h-full flex items-center justify-center">
            <div className="w-full max-w-4xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">Active Tabs</h2>
              </div>
              {windowGroups.length > 0 ? (
                <div className="overflow-hidden">
                  <ScrollArea className="h-[calc(100vh-140px)] scrollbar-none">
                    <div className="space-y-6 px-6 py-2">
                      {windowGroups.map((windowGroup) => {
                        return (
                          <div key={windowGroup.windowId}>
                            {/* Per-window toolbar */}
                            <div className="flex items-center justify-end mb-2">
                              <TopToolbar
                                showTags={showTags}
                                onToggleShowTags={toggleShowTags}
                                showUrls={showUrls}
                                onToggleShowUrls={toggleShowUrls}
                                selectedTabsCount={selectedTabs.length}
                                tabsCount={windowGroup.tabs.length}
                                onSelectAll={handleSelectAll}
                                onRefresh={handleRefresh}
                                onHistory={onHistory}
                                onSortTabs={(sortType) =>
                                  handleSortTabs(windowGroup.windowId, sortType)
                                }
                                onGroupTabs={(_groupType) =>
                                  handleGroupTabsByDomain(windowGroup.windowId)
                                }
                              />
                            </div>
                            <WindowComponent
                              windowId={windowGroup.windowId}
                              tabs={windowGroup.tabs}
                              tabGroups={windowGroup.tabGroups}
                              allTabGroups={tabGroups || []}
                              selectedTabs={selectedTabs}
                              showTags={showTags}
                              showUrls={showUrls}
                              resourceGroups={enrichedResourceGroups}
                              onTabClick={onTabClick}
                              onDeleteTab={onDeleteTab}
                              onPinTab={() => {}}
                              onMuteTab={onMuteTab}
                              onHighlightTab={onHighlightTab}
                              onAddToResourceGroup={onAddToResourceGroup}
                              onSelectTab={(id, selected) =>
                                setSelectedTabs((prev) =>
                                  selected
                                    ? [...prev, id]
                                    : prev.filter((tabId) => tabId !== id),
                                )
                              }
                              onToggleGroupCollapse={onToggleGroupCollapse}
                              onEditGroup={onEditGroup}
                              onUngroupTabs={onUngroupTabs}
                              onCloseTabs={onCloseTabs}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <h2 className="font-semibold text-2xl">No Tabs</h2>
                    <p className="mt-2 text-muted-foreground">
                      Select a workspace from the sidebar to view its tabs
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
