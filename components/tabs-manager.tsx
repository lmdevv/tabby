import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mockTabs } from "@/lib/mock-data";
import { mockResourceGroups, mockResources } from "@/lib/mock-resources";
import { mockTabGroups } from "@/lib/mock-tab-groups";
import { mockWorkspaceGroups } from "@/lib/mock-workspaces";
import type { Resource, ResourceGroup, Tab, TabGroup } from "@/lib/types";
import { GroupDialog } from "./group-dialog";
import { QuickActionsPanel } from "./quick-actions-panel";
import { ResourcesPanel } from "./resources-panel";
import { TabsStats } from "./tabs-stats";
import { TopToolbar } from "./top-toolbar";
import { WindowComponent } from "./window-component";

// Add a new interface for tab groups in a window
interface TabGroupInWindow {
  groupId: number;
  tabs: Tab[];
  collapsed: boolean;
}

type FilterType =
  | "all"
  | "pinned"
  | "audible"
  | "muted"
  | "highlighted"
  | "discarded";

interface WindowGroupData {
  windowId: number;
  tabs: Tab[];
  tabGroups: TabGroupInWindow[];
  minimized: boolean;
}

export function TabsManager() {
  // State for tabs and tab groups
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [tabGroups, setTabGroups] = useState<TabGroup[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceGroups, setResourceGroups] = useState<ResourceGroup[]>([]);

  // UI state
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(true);
  const [showUrls, setShowUrls] = useState(true);
  const [selectedTabs, setSelectedTabs] = useState<number[]>([]);
  const [minimizedWindows, setMinimizedWindows] = useState<number[]>([]);

  // Dialog state
  const [groupDialog, setGroupDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    groupId?: number;
    initialName?: string;
    initialColor?: string;
  }>({
    open: false,
    mode: "create",
  });

  // Load data
  useEffect(() => {
    setTabs(mockTabs);
    setTabGroups(mockTabGroups);
    setResources(mockResources);
    setResourceGroups(mockResourceGroups);
  }, []);

  // Get active workspace
  const activeWorkspace = mockWorkspaceGroups
    .flatMap((group) => group.workspaces)
    .find((workspace) => workspace.active === 1);

  // Get resource groups for active workspace
  const activeWorkspaceResourceGroups = activeWorkspace
    ? resourceGroups.filter((group) =>
        activeWorkspace.resourceGroupIds.includes(group.id),
      )
    : [];

  // Get all unique tags from tabs
  const allTags = Array.from(
    new Set(tabs.flatMap((tab) => tab.tags || []).filter(Boolean)),
  );

  // Filter tabs based on active filter and selected tags
  const filteredTabs = tabs
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
      if (a.windowId === b.windowId) {
        return a.index - b.index;
      }
      return a.windowId - b.windowId;
    });

  // Group tabs by windowId and then by groupId within each window
  const windowGroups: WindowGroupData[] = filteredTabs.reduce(
    (groups: WindowGroupData[], tab) => {
      let windowGroup = groups.find((group) => group.windowId === tab.windowId);
      if (!windowGroup) {
        windowGroup = {
          windowId: tab.windowId,
          tabs: [],
          tabGroups: [],
          minimized: minimizedWindows.includes(tab.windowId),
        };
        groups.push(windowGroup);
      }

      windowGroup.tabs.push(tab);

      if (tab.groupId) {
        let tabGroup = windowGroup.tabGroups.find(
          (group) => group.groupId === tab.groupId,
        );
        if (!tabGroup && tab.groupId) {
          const groupInfo = tabGroups.find((g) => g.id === tab.groupId);
          tabGroup = {
            groupId: tab.groupId,
            tabs: [],
            collapsed: groupInfo?.collapsed || false,
          };
          windowGroup.tabGroups.push(tabGroup);
        }
        tabGroup.tabs.push(tab);
      }

      return groups;
    },
    [],
  );

  // Get the selected tab objects
  const selectedTabObjects = tabs.filter((tab) =>
    selectedTabs.includes(tab.id),
  );

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
    selectedTabObjects.every(
      (tab) => tab.groupId === selectedTabObjects[0].groupId,
    );

  const someSelectedTabsHaveGroup = selectedTabObjects.some(
    (tab) => tab.groupId !== undefined,
  );
  const canGroup = selectedTabs.length > 1 && !selectedTabsInSameGroup;
  const canUngroup = someSelectedTabsHaveGroup;

  // Event handlers
  const handleTabClick = (tab: Tab) => {
    console.log(`Switching to tab: ${tab.title}`);
  };

  const handleDeleteTab = (id: number) => {
    console.log(`Closing tab with id: ${id}`);
    setTabs((prevTabs) => prevTabs.filter((tab) => tab.id !== id));
    setSelectedTabs((prev) => prev.filter((tabId) => tabId !== id));
  };

  const _handlePinTab = (_id: number, _pinned: boolean) => {
    // Pinned tabs feature removed
    console.log("Pinned tabs feature has been removed");
  };

  const handleMuteTab = (id: number, muted: boolean) => {
    console.log(`${muted ? "Muting" : "Unmuting"} tab with id: ${id}`);
    setTabs((prevTabs) =>
      prevTabs.map((tab) =>
        tab.id === id
          ? { ...tab, mutedInfo: { ...tab.mutedInfo, muted } }
          : tab,
      ),
    );
  };

  const handleHighlightTab = (id: number, highlighted: boolean) => {
    console.log(
      `${highlighted ? "Highlighting" : "Unhighlighting"} tab with id: ${id}`,
    );
    setTabs((prevTabs) =>
      prevTabs.map((tab) => (tab.id === id ? { ...tab, highlighted } : tab)),
    );
  };

  const handleSelectTab = (id: number, selected: boolean) => {
    setSelectedTabs((prev) =>
      selected ? [...prev, id] : prev.filter((tabId) => tabId !== id),
    );
  };

  const _allPinned = false; // Pinned feature removed

  const handleTogglePinTabs = () => {
    // Pinned tabs feature removed
    console.log("Pinned tabs feature has been removed");
  };

  const handleToggleMuteTabs = () => {
    const setMuted = !allMuted;
    setTabs((prev) =>
      prev.map((tab) =>
        selectedTabs.includes(tab.id)
          ? { ...tab, mutedInfo: { ...tab.mutedInfo, muted: setMuted } }
          : tab,
      ),
    );
    console.log(
      `${setMuted ? "Muting" : "Unmuting"} ${selectedTabs.length} tabs`,
    );
  };

  const handleToggleHighlightTabs = () => {
    const setHighlighted = !allHighlighted;
    setTabs((prev) =>
      prev.map((tab) =>
        selectedTabs.includes(tab.id)
          ? { ...tab, highlighted: setHighlighted }
          : tab,
      ),
    );
    console.log(
      `${setHighlighted ? "Highlighting" : "Unhighlighting"} ${selectedTabs.length} tabs`,
    );
  };

  const handleCloseTabs = () => {
    setTabs((prev) => prev.filter((tab) => !selectedTabs.includes(tab.id)));
    setSelectedTabs([]);
    console.log(`Closing ${selectedTabs.length} tabs`);
  };

  const handleSelectAll = () => {
    if (selectedTabs.length === filteredTabs.length) {
      setSelectedTabs([]);
    } else {
      setSelectedTabs(filteredTabs.map((tab) => tab.id));
    }
  };

  const handleToggleGroupCollapse = (_windowId: number, groupId: number) => {
    setTabGroups((prevGroups) =>
      prevGroups.map((group) =>
        group.id === groupId
          ? { ...group, collapsed: !group.collapsed }
          : group,
      ),
    );
  };

  const handleGroupTabs = () => {
    setGroupDialog({
      open: true,
      mode: "create",
    });
  };

  const handleUngroupTabs = (tabIds: number[]) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tabIds.includes(tab.id) ? { ...tab, groupId: undefined } : tab,
      ),
    );
    if (tabIds === selectedTabs) {
      setSelectedTabs([]);
    }
    console.log(`Ungrouping ${tabIds.length} tabs`);
  };

  const handleCloseTabsById = (tabIds: number[]) => {
    setTabs((prev) => prev.filter((tab) => !tabIds.includes(tab.id)));
    setSelectedTabs((prev) => prev.filter((tabId) => !tabIds.includes(tabId)));
  };

  const handleEditGroup = (groupId: number) => {
    const group = tabGroups.find((g) => g.id === groupId);
    if (group) {
      setGroupDialog({
        open: true,
        mode: "edit",
        groupId,
        initialName: group.name,
        initialColor: group.color,
      });
    }
  };

  const handleCreateGroup = (name: string, color: string) => {
    const newGroupId = Math.max(...tabGroups.map((g) => g.id), 0) + 1;
    const newGroup = {
      id: newGroupId,
      name,
      color,
      collapsed: false,
    };

    setTabGroups((prev) => [...prev, newGroup]);
    setTabs((prev) =>
      prev.map((tab) =>
        selectedTabs.includes(tab.id) ? { ...tab, groupId: newGroupId } : tab,
      ),
    );
    setSelectedTabs([]);
    console.log(`Created group "${name}" with ${selectedTabs.length} tabs`);
  };

  const handleEditGroupConfirm = (name: string, color: string) => {
    if (groupDialog.groupId) {
      setTabGroups((prev) =>
        prev.map((group) =>
          group.id === groupDialog.groupId ? { ...group, name, color } : group,
        ),
      );
      console.log(`Updated group "${name}"`);
    }
  };

  const handleToggleWindowMinimize = (windowId: number) => {
    setMinimizedWindows((prev) =>
      prev.includes(windowId)
        ? prev.filter((id) => id !== windowId)
        : [...prev, windowId],
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Tabs Manager</h1>
          {activeWorkspace && (
            <p className="text-muted-foreground text-sm">
              Workspace:{" "}
              <span className="font-medium">{activeWorkspace.name}</span>
            </p>
          )}
        </div>

        <TopToolbar
          showTags={showTags}
          showUrls={showUrls}
          selectedTabsCount={selectedTabs.length}
          filteredTabsCount={filteredTabs.length}
          activeFilter={activeFilter}
          selectedTags={selectedTags}
          allTags={allTags}
          onToggleShowTags={() => setShowTags(!showTags)}
          onToggleShowUrls={() => setShowUrls(!showUrls)}
          onSelectAll={handleSelectAll}
          onFilterChange={setActiveFilter}
          onToggleTag={(tag) =>
            setSelectedTags((prev) =>
              prev.includes(tag)
                ? prev.filter((t) => t !== tag)
                : [...prev, tag],
            )
          }
        />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <TabsStats
          filteredTabsCount={filteredTabs.length}
          totalTabsCount={tabs.length}
          activeFilter={activeFilter}
          selectedTags={selectedTags}
        />

        <QuickActionsPanel
          selectedTabsCount={selectedTabs.length}
          allPinned={false}
          allMuted={allMuted}
          allHighlighted={allHighlighted}
          canGroup={canGroup}
          canUngroup={canUngroup}
          onCloseTabs={handleCloseTabs}
          onTogglePinTabs={handleTogglePinTabs}
          onToggleMuteTabs={handleToggleMuteTabs}
          onToggleHighlightTabs={handleToggleHighlightTabs}
          onGroupTabs={handleGroupTabs}
          onUngroupTabs={() => handleUngroupTabs(selectedTabs)}
        />
      </div>

      <div className="grid h-[calc(100vh-220px)] grid-cols-1 gap-6 md:grid-cols-2">
        {/* Active Tabs Section */}
        <div className="flex h-full flex-col">
          <h2 className="mb-4 font-semibold text-lg">Active Tabs</h2>
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-[calc(100vh-300px)]">
              {windowGroups.length > 0 ? (
                windowGroups.map((windowGroup, windowIndex) => (
                  <WindowComponent
                    key={windowGroup.windowId}
                    windowId={windowGroup.windowId}
                    windowIndex={windowIndex}
                    tabs={windowGroup.tabs}
                    tabGroups={windowGroup.tabGroups}
                    allTabGroups={tabGroups}
                    selectedTabs={selectedTabs}
                    showTags={showTags}
                    showUrls={showUrls}
                    onTabClick={handleTabClick}
                    onDeleteTab={handleDeleteTab}
                    onMuteTab={handleMuteTab}
                    onHighlightTab={handleHighlightTab}
                    onSelectTab={handleSelectTab}
                    onToggleGroupCollapse={handleToggleGroupCollapse}
                    onEditGroup={handleEditGroup}
                    onUngroupTabs={handleUngroupTabs}
                    onCloseTabs={handleCloseTabsById}
                    minimized={windowGroup.minimized}
                    onToggleMinimize={handleToggleWindowMinimize}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="mb-2 text-muted-foreground">No tabs found</p>
                  <p className="text-muted-foreground text-sm">
                    Try changing your filters or opening new tabs.
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Resources Section */}
        <div className="flex h-full flex-col">
          <ResourcesPanel
            resourceGroups={activeWorkspaceResourceGroups}
            resources={resources}
            showTags={showTags}
            showUrls={showUrls}
          />
        </div>
      </div>

      <GroupDialog
        open={groupDialog.open}
        onOpenChange={(open) => setGroupDialog((prev) => ({ ...prev, open }))}
        onConfirm={
          groupDialog.mode === "create"
            ? handleCreateGroup
            : handleEditGroupConfirm
        }
        initialName={groupDialog.initialName}
        initialColor={groupDialog.initialColor}
        title={
          groupDialog.mode === "create" ? "Create Tab Group" : "Edit Tab Group"
        }
        description={
          groupDialog.mode === "create"
            ? `Group ${selectedTabs.length} selected tabs together`
            : "Edit the group name and color"
        }
      />
    </div>
  );
}
