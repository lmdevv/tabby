import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useMemo, useState } from "react";
import { browser } from "wxt/browser";
import { AppContent } from "@/components/app/AppContent";
import { AppHeader } from "@/components/app/AppHeader";
import { GroupDialog } from "@/components/dialogs/group-dialog";
import { AppSidebar } from "@/components/sidebar/app-sidebar";

import { QuickActionsPanel } from "@/components/toolbar/quick-actions-panel";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAddTabToResourceGroup } from "@/hooks/use-resources";
import { db } from "@/lib/db";

export default function App() {
  const [previewWorkspaceId, setPreviewWorkspaceId] = useState<number | null>(
    null,
  );

  const [groupDialog, setGroupDialog] = useState<{
    open: boolean;
    groupId?: number;
  }>({
    open: false,
  });

  // Get workspace data directly using Dexie
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

  // Memoize the shown workspace ID to prevent unnecessary re-renders
  const shownWorkspaceId = useMemo(
    () =>
      previewWorkspaceId !== null
        ? previewWorkspaceId
        : workspaceData?.activeWorkspace?.id,
    [previewWorkspaceId, workspaceData?.activeWorkspace?.id],
  );

  // Get tab groups for the current workspace
  const tabGroups = useLiveQuery(() => {
    if (!shownWorkspaceId) return [];
    return db.tabGroups.where("workspaceId").equals(shownWorkspaceId).toArray();
  }, [shownWorkspaceId]);

  // Hook for adding tabs to resource groups
  const { addTabToResourceGroup } = useAddTabToResourceGroup();

  // Event handlers for tab management
  const handleTabClick = useCallback(
    async (tab: { id?: number; windowId?: number }) => {
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
    },
    [],
  );

  const handleDeleteTab = useCallback(async (id: number) => {
    try {
      await browser.tabs.remove(id);
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

  const handleAddToResourceGroup = useCallback(
    async (
      tab: { title?: string; url?: string; favIconUrl?: string },
      groupId: number,
    ) => {
      try {
        await addTabToResourceGroup(tab, groupId);
      } catch (error) {
        console.error("Failed to add tab to resource group:", error);
      }
    },
    [addTabToResourceGroup],
  );

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

  return (
    <SidebarProvider>
      <AppSidebar
        previewWorkspaceId={previewWorkspaceId}
        setPreviewWorkspaceId={setPreviewWorkspaceId}
      />
      <SidebarInset>
        <AppHeader
          previewWorkspaceId={previewWorkspaceId}
          onOpenWorkspace={() => {
            if (
              shownWorkspaceId &&
              shownWorkspaceId !== workspaceData?.activeWorkspace?.id &&
              shownWorkspaceId !== -1
            ) {
              browser.runtime.sendMessage({
                type: "openWorkspace",
                workspaceId: shownWorkspaceId,
              });
              setPreviewWorkspaceId(null);
            }
          }}
        />

        {/* Quick Actions Panel */}
        <QuickActionsPanel />

        <AppContent
          previewWorkspaceId={previewWorkspaceId}
          shownWorkspaceId={shownWorkspaceId || null}
          onTabClick={handleTabClick}
          onDeleteTab={handleDeleteTab}
          onMuteTab={handleMuteTab}
          onHighlightTab={handleHighlightTab}
          onAddToResourceGroup={handleAddToResourceGroup}
          onToggleGroupCollapse={handleToggleGroupCollapse}
          onEditGroup={handleEditGroup}
          onUngroupTabs={handleUngroupTabs}
          onCloseTabs={handleCloseTabsById}
        />
      </SidebarInset>

      {/* Group Edit Dialog */}
      <GroupDialog
        open={groupDialog.open}
        onOpenChange={(open) => setGroupDialog({ ...groupDialog, open })}
        onConfirm={() => {}} // TODO: implement edit group confirmation
        groupId={groupDialog.groupId}
        title="Edit Tab Group"
        description="Edit the group name and color"
      />
    </SidebarProvider>
  );
}
