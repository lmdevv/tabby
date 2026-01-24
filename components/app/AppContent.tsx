import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useMemo } from "react";
import { ResourcesPanel } from "@/components/resources/resources-panel";
import { WindowComponent } from "@/components/tabs/window-component";
import { TopToolbar } from "@/components/toolbar/top-toolbar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGlobalKeybindings } from "@/hooks/use-global-keybindings";
import { useAppState, useUpdateState } from "@/hooks/use-state";

import { db } from "@/lib/db/db";
import { refreshTabs } from "@/lib/helpers/tab-operations";
import type { Tab } from "@/lib/types/types";

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
  shownWorkspaceId: number | null;
  onTabClick: (tab: Tab) => Promise<void>;
  onEditGroup: (groupId: number) => Promise<void>;
  // When previewing a workspace, we should include archived tabs
  isPreview?: boolean;
  // In preview mode, clicking a tab should activate the workspace and focus the tab
  onPreviewTabClick?: (tab: Tab) => Promise<void>;
  // Callback to open keybindings dialog
  onOpenKeybindingsDialog: () => void;
}

export function AppContent({
  shownWorkspaceId,
  onTabClick,
  onEditGroup,
  isPreview = false,
  onPreviewTabClick,
  onOpenKeybindingsDialog,
}: AppContentProps) {
  // Get settings directly in the component
  const { data: showResourcesData } = useAppState("showResources");
  const { data: activeWindowIdData } = useAppState("activeWindowId");
  const { updateState } = useUpdateState();

  const showResources = (showResourcesData ?? true) as boolean;
  const activeWindowId = (activeWindowIdData ?? "-1") as string;

  // Get tabs data directly using Dexie
  const shownTabs = useLiveQuery(() => {
    if (!shownWorkspaceId) return [];
    // In preview mode, include archived tabs; otherwise only active
    const base = db.activeTabs.where("workspaceId").equals(shownWorkspaceId);
    return isPreview
      ? base.toArray()
      : base.and((tab) => tab.tabStatus === "active").toArray();
  }, [shownWorkspaceId, isPreview]);

  // Get tab groups data directly using Dexie
  const tabGroups = useLiveQuery(() => {
    if (!shownWorkspaceId) return [];
    return db.tabGroups.where("workspaceId").equals(shownWorkspaceId).toArray();
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

  const effectiveActiveWindowId = useMemo(() => {
    if (windowGroups.length === 0) {
      return activeWindowId;
    }

    const isValidActiveWindow = windowGroups.some(
      (w) => w.windowId.toString() === activeWindowId,
    );

    if (activeWindowId === "-1" || !isValidActiveWindow) {
      return windowGroups[0].windowId.toString();
    }

    return activeWindowId;
  }, [windowGroups, activeWindowId]);

  // Window navigation callbacks
  const goToPrevWindow = useCallback(() => {
    if (windowGroups.length === 0) return;

    const targetActiveWindowId = effectiveActiveWindowId;
    if (!targetActiveWindowId) return;

    const currentIndex = windowGroups.findIndex(
      (w) => w.windowId.toString() === targetActiveWindowId,
    );

    if (currentIndex === -1) {
      if (targetActiveWindowId !== activeWindowId) {
        updateState("activeWindowId", targetActiveWindowId);
      }
      return;
    }

    const nextIndex =
      currentIndex === 0 ? windowGroups.length - 1 : currentIndex - 1;

    const nextWindowId = windowGroups[nextIndex].windowId.toString();
    updateState("activeWindowId", nextWindowId);
  }, [windowGroups, effectiveActiveWindowId, activeWindowId, updateState]);

  const goToNextWindow = useCallback(() => {
    if (windowGroups.length === 0) return;

    const targetActiveWindowId = effectiveActiveWindowId;
    if (!targetActiveWindowId) return;

    const currentIndex = windowGroups.findIndex(
      (w) => w.windowId.toString() === targetActiveWindowId,
    );

    if (currentIndex === -1) {
      if (targetActiveWindowId !== activeWindowId) {
        updateState("activeWindowId", targetActiveWindowId);
      }
      return;
    }

    const nextIndex =
      currentIndex === windowGroups.length - 1 ? 0 : currentIndex + 1;

    const nextWindowId = windowGroups[nextIndex].windowId.toString();
    updateState("activeWindowId", nextWindowId);
  }, [windowGroups, effectiveActiveWindowId, activeWindowId, updateState]);

  // Refresh tabs handler for global keybindings
  const handleRefreshTabs = useCallback(async () => {
    await refreshTabs({ workspaceId: shownWorkspaceId });
  }, [shownWorkspaceId]);

  // Global keybindings that work regardless of tab state
  useGlobalKeybindings({
    onOpenKeybindingsDialog,
    onRefreshTabs: handleRefreshTabs,
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex-1 h-full">
        {showResources ? (
          /* Split Layout - Both panels */
          <div className="grid gap-4 h-full overflow-hidden grid-cols-[minmax(280px,1fr)_minmax(250px,1fr)]">
            {/* Active Tabs Panel */}
            <div className="flex flex-col min-w-0 overflow-hidden">
              {/* Header and toolbar - always visible */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">Active Tabs</h2>
                <TopToolbar
                  workspaceId={shownWorkspaceId}
                  isPreview={isPreview}
                />
              </div>

              {/* Tabs content - conditional */}
              {windowGroups.length > 0 ? (
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[calc(100vh-140px)] scrollbar-none">
                    <div className="space-y-6 px-6 py-2 min-w-0">
                      {windowGroups.map((windowGroup) => {
                        const isActiveWindow =
                          windowGroup.windowId.toString() ===
                          effectiveActiveWindowId;
                        return (
                          <div
                            key={windowGroup.windowId}
                            className="w-full"
                            data-window-id={windowGroup.windowId}
                          >
                            {shownWorkspaceId && (
                              <WindowComponent
                                windowId={windowGroup.windowId}
                                workspaceId={shownWorkspaceId}
                                onTabClick={
                                  isPreview && onPreviewTabClick
                                    ? (tab) => onPreviewTabClick(tab)
                                    : onTabClick
                                }
                                onEditGroup={onEditGroup}
                                isPreview={isPreview}
                                isActiveWindow={isActiveWindow}
                                onFocusPrevWindow={goToPrevWindow}
                                onFocusNextWindow={goToNextWindow}
                                onOpenKeybindingsDialog={
                                  onOpenKeybindingsDialog
                                }
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center">
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
            <div className="flex flex-col min-w-0 overflow-hidden">
              <div className="flex-1">
                <ResourcesPanel />
              </div>
            </div>
          </div>
        ) : (
          /* Single Layout - Only active tabs, centered */
          <div className="h-full flex flex-col">
            {/* Header and toolbar - always visible */}
            <div className="flex items-center justify-between mb-4 max-w-4xl mx-auto w-full">
              <h2 className="font-semibold text-lg">Active Tabs</h2>
              <TopToolbar
                workspaceId={shownWorkspaceId}
                isPreview={isPreview}
              />
            </div>

            {/* Tabs content - conditional */}
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-4xl">
                {windowGroups.length > 0 ? (
                  <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-[calc(100vh-180px)] scrollbar-none">
                      <div className="space-y-6 px-6 py-2 min-w-0">
                        {windowGroups.map((windowGroup) => {
                          const isActiveWindow =
                            windowGroup.windowId.toString() ===
                            effectiveActiveWindowId;
                          return (
                            <div
                              key={windowGroup.windowId}
                              className="w-full"
                              data-window-id={windowGroup.windowId}
                            >
                              {shownWorkspaceId && (
                                <WindowComponent
                                  windowId={windowGroup.windowId}
                                  workspaceId={shownWorkspaceId}
                                  onTabClick={
                                    isPreview && onPreviewTabClick
                                      ? (tab) => onPreviewTabClick(tab)
                                      : onTabClick
                                  }
                                  onEditGroup={onEditGroup}
                                  isPreview={isPreview}
                                  isActiveWindow={isActiveWindow}
                                  onFocusPrevWindow={goToPrevWindow}
                                  onFocusNextWindow={goToNextWindow}
                                  onOpenKeybindingsDialog={
                                    onOpenKeybindingsDialog
                                  }
                                />
                              )}
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
          </div>
        )}
      </div>
    </div>
  );
}
