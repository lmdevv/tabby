import { useCallback, useMemo, useState } from "react";
import { GroupDialog } from "@/components/dialogs/group-dialog";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { TabsStats } from "@/components/tabs/tabs-stats";
import { WindowComponent } from "@/components/tabs/window-component";
import { QuickActionsPanel } from "@/components/toolbar/quick-actions-panel";
import { TopToolbar } from "@/components/toolbar/top-toolbar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { db } from "@/lib/db";
import { hexToBrowserColor } from "@/lib/tab-group-colors";
import type { Tab } from "@/lib/types";

// type TabGroup = Browser.tabGroups.TabGroup;

import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { browser } from "wxt/browser";
import { ResourcesPanel } from "@/components/resources/resources-panel";
import { HistoryDialog } from "@/components/snapshots/history-dialog";
import { ModeToggle } from "@/components/theme/mode-toggle";
import {
  useAddTabToResourceGroup,
  useResourceGroups,
  useResources,
} from "@/hooks/use-resources";

type FilterType =
  | "all"
  | "pinned"
  | "audible"
  | "muted"
  | "highlighted"
  | "discarded";

interface TabGroupInWindow {
  groupId: number;
  tabs: Tab[];
  collapsed: boolean;
}

interface WindowGroupData {
  windowId: number;
  tabs: Tab[];
  tabGroups: TabGroupInWindow[];
  minimized: boolean;
}

export default function App() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewWorkspaceId, setPreviewWorkspaceId] = useState<number | null>(
    null,
  );

  // UI state for the new tab management system
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(true);
  const [showUrls, setShowUrls] = useState(true);
  const [selectedTabs, setSelectedTabs] = useState<number[]>([]);
  const [minimizedWindows, _setMinimizedWindows] = useState<number[]>([]);
  const [groupDialog, setGroupDialog] = useState<{
    open: boolean;
    groupId?: number;
  }>({
    open: false,
  });

  const { addTabToResourceGroup } = useAddTabToResourceGroup();
  const resourceGroups = useResourceGroups();
  const resources = useResources();

  // Combine workspace queries to reduce re-renders
  const workspaceData = useLiveQuery(async () => {
    const activeWorkspace = await db.workspaces
      .where("active")
      .equals(1)
      .first();
    const shownWorkspaceId =
      previewWorkspaceId !== null ? previewWorkspaceId : activeWorkspace?.id;
    const shownWorkspace =
      shownWorkspaceId === -1
        ? undefined
        : shownWorkspaceId
          ? await db.workspaces.get(shownWorkspaceId)
          : undefined;

    const workspaceGroup = shownWorkspace?.groupId
      ? await db.workspaceGroups.get(shownWorkspace.groupId)
      : undefined;

    return {
      activeWorkspace,
      shownWorkspace,
      workspaceGroup,
      shownWorkspaceId,
    };
  }, [previewWorkspaceId]);

  // Get active tabs for resource status indicators
  const activeTabs = useLiveQuery(async () => {
    if (!workspaceData?.activeWorkspace) return [];
    return db.activeTabs
      .where("workspaceId")
      .equals(workspaceData.activeWorkspace.id)
      .toArray();
  }, [workspaceData?.activeWorkspace]);

  // Memoize the shown workspace ID to prevent unnecessary re-renders
  const shownWorkspaceId = useMemo(
    () =>
      previewWorkspaceId !== null
        ? previewWorkspaceId
        : workspaceData?.activeWorkspace?.id,
    [previewWorkspaceId, workspaceData?.activeWorkspace?.id],
  );

  // Optimize tabs query to only fetch when needed
  const shownTabs = useLiveQuery(() => {
    if (!shownWorkspaceId) return [];
    return db.activeTabs
      .where("workspaceId")
      .equals(shownWorkspaceId)
      .toArray();
  }, [shownWorkspaceId]);

  // Query tab groups from the database instead of browser API
  // For active workspace, only show active groups
  // For non-active workspaces (preview), show all groups (active + archived) to display group info
  const tabGroups = useLiveQuery(() => {
    if (!shownWorkspaceId) return [];

    const isActiveWorkspace =
      shownWorkspaceId === workspaceData?.activeWorkspace?.id;

    if (isActiveWorkspace) {
      // For active workspace, only show active groups for this specific workspace
      return db.tabGroups
        .where("workspaceId")
        .equals(shownWorkspaceId)
        .and((g) => g.groupStatus === "active")
        .toArray();
    }

    // For preview workspaces, show all groups (active + archived) for this specific workspace
    // to display group properties correctly
    return db.tabGroups.where("workspaceId").equals(shownWorkspaceId).toArray();
  }, [shownWorkspaceId, workspaceData?.activeWorkspace?.id]);

  const handleRefresh = useCallback((): void => {
    browser.runtime.sendMessage({ type: "refreshTabs" });
  }, []);

  const handleOpenWorkspace = useCallback(async () => {
    if (
      shownWorkspaceId &&
      shownWorkspaceId !== workspaceData?.activeWorkspace?.id &&
      shownWorkspaceId !== -1
    ) {
      try {
        await browser.runtime.sendMessage({
          type: "openWorkspace",
          workspaceId: shownWorkspaceId,
        });
        setPreviewWorkspaceId(null);
      } catch (error) {
        console.error("Failed to switch workspace:", error);
      }
    }
  }, [shownWorkspaceId, workspaceData?.activeWorkspace?.id]);

  const handleCloseWorkspace = useCallback(async () => {
    if (workspaceData?.activeWorkspace) {
      try {
        await browser.runtime.sendMessage({
          type: "closeWorkspace",
        });
        setPreviewWorkspaceId(null);
      } catch (error) {
        console.error("Failed to close workspace:", error);
      }
    }
  }, [workspaceData?.activeWorkspace]);

  // Get all unique tags from tabs
  const allTags = useMemo(() => {
    if (!shownTabs?.length) return [];
    return Array.from(
      new Set(shownTabs.flatMap((tab) => tab.tags || []).filter(Boolean)),
    );
  }, [shownTabs]);

  // Filter tabs based on active filter and selected tags
  const filteredTabs = useMemo(() => {
    if (!shownTabs?.length) return [];

    return shownTabs
      .filter((tab) => {
        if (activeFilter === "pinned") return tab.pinned;
        if (activeFilter === "audible") return tab.audible;
        if (activeFilter === "muted") return tab.mutedInfo?.muted;
        if (activeFilter === "discarded") return tab.discarded;
        if (activeFilter === "highlighted") return tab.highlighted;
        return true;
      })
      .filter((tab) => {
        if (selectedTags.length === 0) return true;
        return selectedTags.every((tag) => tab.tags?.includes(tag));
      })
      .sort((a, b) => {
        // First sort by window ID
        if (a.windowId !== b.windowId) {
          return a.windowId - b.windowId;
        }
        // Then sort by browser tab index within the same window
        return a.index - b.index;
      });
  }, [shownTabs, activeFilter, selectedTags]);

  // Create an improved window grouping that maintains browser tab order
  const windowGroups: WindowGroupData[] = useMemo(() => {
    if (!filteredTabs.length) return [];

    // Group tabs by window first
    const tabsByWindow = filteredTabs.reduce(
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
        const windowTabGroups: TabGroupInWindow[] = [];
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
          minimized: minimizedWindows.includes(windowId),
        };
      })
      .sort((a, b) => a.windowId - b.windowId);
  }, [filteredTabs, minimizedWindows, tabGroups]);

  // Get the selected tab objects
  const selectedTabObjects = useMemo(() => {
    if (!shownTabs?.length) return [];
    return shownTabs.filter(
      (tab) => tab.id !== undefined && selectedTabs.includes(tab.id),
    );
  }, [shownTabs, selectedTabs]);

  // Determine the state of selected tabs
  const allMuted =
    selectedTabObjects.length > 0 &&
    selectedTabObjects.every((tab) => tab.mutedInfo?.muted);
  const allHighlighted =
    selectedTabObjects.length > 0 &&
    selectedTabObjects.every((tab) => tab.highlighted);

  // Check if selected tabs can be grouped/ungrouped
  const selectedTabsInSameGroup =
    selectedTabObjects.length > 0 &&
    selectedTabObjects[0].groupId !== undefined &&
    selectedTabObjects[0].groupId !== -1 &&
    selectedTabObjects.every(
      (tab) => tab.groupId === selectedTabObjects[0].groupId,
    );

  const someSelectedTabsHaveGroup = selectedTabObjects.some(
    (tab) => tab.groupId !== undefined && tab.groupId !== -1,
  );
  const canGroup = selectedTabs.length > 1 && !selectedTabsInSameGroup;
  const canUngroup = someSelectedTabsHaveGroup;

  // Event handlers for tab management
  const handleTabClick = useCallback(async (tab: Tab) => {
    try {
      if (tab.id !== undefined) {
        await browser.tabs.update(tab.id, { active: true });
        if (typeof tab.windowId === "number") {
          await browser.windows.update(tab.windowId, { focused: true });
        }
      }
    } catch (error) {
      console.error("Failed to switch to tab:", error);
    }
  }, []);

  const handleDeleteTab = useCallback(async (id: number) => {
    try {
      await browser.tabs.remove(id);
      setSelectedTabs((prev) => prev.filter((tabId) => tabId !== id));
    } catch (error) {
      console.error("Failed to close tab:", error);
    }
  }, []);

  const handleMuteTab = useCallback(async (id: number, muted: boolean) => {
    try {
      await browser.tabs.update(id, { muted });
    } catch (error) {
      console.error("Failed to mute/unmute tab:", error);
    }
  }, []);

  const handleHighlightTab = useCallback(
    async (id: number, highlighted: boolean) => {
      try {
        await browser.tabs.update(id, { highlighted });
      } catch (error) {
        console.error("Failed to highlight/unhighlight tab:", error);
      }
    },
    [],
  );

  const handleSelectTab = useCallback((id: number, selected: boolean) => {
    setSelectedTabs((prev) =>
      selected ? [...prev, id] : prev.filter((tabId) => tabId !== id),
    );
  }, []);

  const handleToggleMuteTabs = useCallback(async () => {
    const setMuted = !allMuted;
    try {
      await Promise.all(
        selectedTabs.map((id) => browser.tabs.update(id, { muted: setMuted })),
      );
    } catch (error) {
      console.error("Failed to toggle mute tabs:", error);
    }
  }, [selectedTabs, allMuted]);

  const handleToggleHighlightTabs = useCallback(async () => {
    const setHighlighted = !allHighlighted;
    try {
      await Promise.all(
        selectedTabs.map((id) =>
          browser.tabs.update(id, { highlighted: setHighlighted }),
        ),
      );
    } catch (error) {
      console.error("Failed to toggle highlight tabs:", error);
    }
  }, [selectedTabs, allHighlighted]);

  const handleCopySelectedLinks = useCallback(async () => {
    try {
      const urls = selectedTabObjects
        .map((tab) => tab.url)
        .filter((u): u is string => Boolean(u));
      if (urls.length === 0) return;
      const text = urls.join("\n");
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success(
        urls.length === 1
          ? "Link copied to clipboard"
          : `Copied ${urls.length} links`,
      );
    } catch (error) {
      console.error("Failed to copy links:", error);
      toast.error("Failed to copy links");
    }
  }, [selectedTabObjects]);

  const handleCloseTabs = useCallback(async () => {
    try {
      await browser.tabs.remove(selectedTabs);
      setSelectedTabs([]);
    } catch (error) {
      console.error("Failed to close selected tabs:", error);
    }
  }, [selectedTabs]);

  const handleSelectAll = useCallback(() => {
    if (!filteredTabs?.length) return;
    const allTabIds = filteredTabs
      .map((tab) => tab.id)
      .filter((id): id is number => id !== undefined);
    setSelectedTabs(selectedTabs.length === allTabIds.length ? [] : allTabIds);
  }, [filteredTabs, selectedTabs.length]);

  const handleToggleGroupCollapse = useCallback(
    async (_windowId: number, groupId: number) => {
      try {
        const group = tabGroups?.find((g) => g.id === groupId);
        if (group && typeof browser?.tabGroups?.update === "function") {
          await browser.tabGroups.update(groupId, {
            collapsed: !group.collapsed,
          });
        }
      } catch (error) {
        console.error("Failed to toggle group collapse:", error);
      }
    },
    [tabGroups],
  );

  const handleGroupTabs = useCallback(async () => {
    if (!canGroup) return;
    try {
      if (typeof browser?.tabs?.group === "function") {
        await browser.tabs.group({
          tabIds: selectedTabs as [number, ...number[]],
        });
        setSelectedTabs([]);
      }
    } catch (error) {
      console.error("Failed to group tabs:", error);
    }
  }, [canGroup, selectedTabs]);

  const handleUngroupTabs = useCallback(async (tabIds: number[]) => {
    try {
      if (typeof browser?.tabs?.ungroup === "function") {
        await browser.tabs.ungroup(tabIds as [number, ...number[]]);
      }
    } catch (error) {
      console.error("Failed to ungroup tabs:", error);
    }
  }, []);

  const handleCloseTabsById = useCallback(async (tabIds: number[]) => {
    try {
      await browser.tabs.remove(tabIds);
    } catch (error) {
      console.error("Failed to close tabs:", error);
    }
  }, []);

  const handleEditGroup = useCallback(async (groupId: number) => {
    try {
      setGroupDialog({
        open: true,
        groupId,
      });
    } catch (error) {
      console.error("Failed to open edit group dialog:", error);
    }
  }, []);

  const handleEditGroupConfirm = useCallback(
    async (name: string, color: string) => {
      if (!groupDialog.groupId) {
        console.error("No groupId in dialog state");
        return;
      }
      try {
        // Convert hex color to browser enum
        const browserColor = hexToBrowserColor(color);

        // Use message passing to background script (following the pattern of other operations)
        await browser.runtime.sendMessage({
          type: "updateTabGroup",
          groupId: groupDialog.groupId,
          title: name,
          color: browserColor,
        });

        console.log(`✅ Updated group "${name}" with color ${color}`);
      } catch (error) {
        console.error("Failed to update group:", error);
        // Log more detailed error information
        if (error instanceof Error) {
          console.error("Error name:", error.name);
          console.error("Error message:", error.message);
          console.error("Error stack:", error.stack);
        }
      }
    },
    [groupDialog.groupId],
  );

  const handleAddToResourceGroup = useCallback(
    async (tab: Tab, groupId: number) => {
      try {
        await addTabToResourceGroup(
          {
            title: tab.title || "Untitled",
            url: tab.url || "",
            favIconUrl: tab.favIconUrl,
          },
          groupId,
        );
      } catch (error) {
        console.error("Failed to add tab to resource group:", error);
      }
    },
    [addTabToResourceGroup],
  );

  return (
    <SidebarProvider>
      <AppSidebar
        previewWorkspaceId={previewWorkspaceId}
        setPreviewWorkspaceId={setPreviewWorkspaceId}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 p-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            {shownWorkspaceId === -1 ? (
              <span className="flex items-center gap-2 font-medium">
                Undefined Workspace
                {previewWorkspaceId !== null &&
                  previewWorkspaceId !== workspaceData?.activeWorkspace?.id && (
                    <Badge variant="outline">Preview</Badge>
                  )}
              </span>
            ) : workspaceData?.shownWorkspace ? (
              <Breadcrumb>
                <BreadcrumbList>
                  {workspaceData.workspaceGroup && (
                    <>
                      <BreadcrumbItem>
                        <BreadcrumbLink>
                          {workspaceData.workspaceGroup.name}
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                    </>
                  )}
                  <BreadcrumbItem>
                    <span className="flex items-center gap-2">
                      <BreadcrumbPage>
                        {workspaceData.shownWorkspace.name}
                      </BreadcrumbPage>
                      {previewWorkspaceId !== null &&
                        previewWorkspaceId !==
                          workspaceData.activeWorkspace?.id && (
                          <Badge variant="secondary">Preview</Badge>
                        )}
                    </span>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            ) : (
              <span className="text-muted-foreground">
                No workspace selected
              </span>
            )}
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Button variant="outline" onClick={handleRefresh}>
              Refresh
            </Button>
            <Button variant="outline" onClick={() => setHistoryOpen(true)}>
              History
            </Button>
            {previewWorkspaceId !== null &&
              previewWorkspaceId !== workspaceData?.activeWorkspace?.id &&
              previewWorkspaceId !== -1 && (
                <Button variant="default" onClick={handleOpenWorkspace}>
                  Open
                </Button>
              )}
            {/* Close workspace button - only show if there's an active workspace and we're not previewing */}
            {workspaceData?.activeWorkspace &&
              previewWorkspaceId === null &&
              shownWorkspaceId !== -1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCloseWorkspace}
                  title="Close workspace and switch to undefined workspace"
                >
                  Close Workspace
                </Button>
              )}
          </div>

          {/* Top Toolbar */}
          <TopToolbar
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            allTags={allTags}
            selectedTags={selectedTags}
            onToggleTag={(tag: string) => {
              setSelectedTags((prev) =>
                prev.includes(tag)
                  ? prev.filter((t) => t !== tag)
                  : [...prev, tag],
              );
            }}
            showTags={showTags}
            onToggleShowTags={() => setShowTags(!showTags)}
            showUrls={showUrls}
            onToggleShowUrls={() => setShowUrls(!showUrls)}
            selectedTabsCount={selectedTabs.length}
            filteredTabsCount={filteredTabs.length}
            onSelectAll={handleSelectAll}
          />

          {/* Tab Stats */}
          <TabsStats
            filteredTabsCount={filteredTabs.length}
            totalTabsCount={shownTabs?.length || 0}
            activeFilter={activeFilter}
            selectedTags={selectedTags}
          />

          {/* Quick Actions Panel */}
          {selectedTabs.length > 0 && (
            <QuickActionsPanel
              selectedTabsCount={selectedTabs.length}
              canGroup={canGroup}
              canUngroup={canUngroup}
              allMuted={allMuted}
              allHighlighted={allHighlighted}
              allPinned={false} // Pin functionality removed
              onCloseTabs={handleCloseTabs}
              onTogglePinTabs={() => {}} // Pin functionality removed
              onToggleMuteTabs={handleToggleMuteTabs}
              onToggleHighlightTabs={handleToggleHighlightTabs}
              onGroupTabs={handleGroupTabs}
              onUngroupTabs={() => handleUngroupTabs(selectedTabs)}
              onCopyLinks={handleCopySelectedLinks}
            />
          )}

          {/* Main content area - Split Layout */}
          <div className="flex-1 grid grid-cols-2 gap-4 h-full">
            {/* Active Tabs Panel */}
            <div className="flex flex-col">
              <h2 className="font-semibold text-lg mb-4">Active Tabs</h2>
              {windowGroups.length > 0 ? (
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[calc(100vh-320px)] sm:h-[calc(100vh-300px)] scrollbar-none">
                    <div className="space-y-6 px-6 py-2">
                      {windowGroups.map((windowGroup, _index) => {
                        return (
                          <WindowComponent
                            key={windowGroup.windowId}
                            windowId={windowGroup.windowId}
                            tabs={windowGroup.tabs}
                            tabGroups={windowGroup.tabGroups}
                            allTabGroups={tabGroups || []}
                            selectedTabs={selectedTabs}
                            showTags={showTags}
                            showUrls={showUrls}
                            resourceGroups={resourceGroups}
                            onTabClick={handleTabClick}
                            onDeleteTab={handleDeleteTab}
                            onPinTab={() => {}} // Pin functionality removed
                            onMuteTab={handleMuteTab}
                            onHighlightTab={handleHighlightTab}
                            onAddToResourceGroup={handleAddToResourceGroup}
                            onSelectTab={handleSelectTab}
                            onToggleGroupCollapse={handleToggleGroupCollapse}
                            onEditGroup={handleEditGroup}
                            onUngroupTabs={handleUngroupTabs}
                            onCloseTabs={handleCloseTabsById}
                          />
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
                  resourceGroups={resourceGroups}
                  resources={resources}
                  showTags={showTags}
                  showUrls={showUrls}
                  activeTabs={activeTabs || []}
                />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Group Edit Dialog */}
      <GroupDialog
        open={groupDialog.open}
        onOpenChange={(open) => setGroupDialog((prev) => ({ ...prev, open }))}
        onConfirm={handleEditGroupConfirm}
        groupId={groupDialog.groupId}
        title="Edit Tab Group"
        description="Edit the group name and color"
      />

      {/* History Dialog */}
      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        workspaceId={shownWorkspaceId ?? -1}
      />
    </SidebarProvider>
  );
}
