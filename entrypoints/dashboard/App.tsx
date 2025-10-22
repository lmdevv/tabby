import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { browser } from "wxt/browser";
import { AppContent } from "@/components/app/AppContent";
import { AppHeader } from "@/components/app/AppHeader";
import { CommandMenu } from "@/components/command-menu/command-menu";
import { AICleanDialog } from "@/components/dialogs/ai-clean-dialog";
import { GroupDialog } from "@/components/dialogs/group-dialog";
import { WorkspaceDialog } from "@/components/dialogs/workspace-dialog";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { CreateWorkspace } from "@/components/sidebar/create-workspace";
import { QuickActionsPanel } from "@/components/toolbar/quick-actions-panel";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAppState, useUpdateState } from "@/hooks/use-state";
import { db } from "@/lib/db/db";
import type { Tab } from "@/lib/types/types";
import { hexToBrowserColor } from "@/lib/ui/tab-group-colors";

export default function App() {
  const [previewWorkspaceId, setPreviewWorkspaceId] = useState<number | null>(
    null,
  );

  const [groupDialog, setGroupDialog] = useState<{
    open: boolean;
    groupId?: number;
    tabIds?: number[];
  }>({
    open: false,
  });

  const [workspaceDialog, setWorkspaceDialog] = useState<{
    open: boolean;
    workspaceId?: number;
    tabIds?: number[];
  }>({
    open: false,
  });

  const [aiCleanDialog, setAiCleanDialog] = useState<{
    open: boolean;
    proposedTabIds: number[];
    instructions: string;
  }>({
    open: false,
    proposedTabIds: [],
    instructions: "",
  });

  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);

  const { updateState } = useUpdateState();
  const { data: confirmAIClean } = useAppState("confirmAIClean");

  // Listen for messages from background script
  useEffect(() => {
    const handleMessage = (message: { type: string }) => {
      if (message.type === "openCommandMenu") {
        setCommandMenuOpen(true);
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, []);

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

  const handlePreviewTabClick = useCallback(async (tab: Tab) => {
    try {
      // Create the tab in the current window - the background listeners will handle adding it to the database
      if (tab.url) {
        await browser.tabs.create({
          url: tab.url,
          active: true,
        });
      }
    } catch (error) {
      console.error("Failed to handle preview tab click:", error);
    }
  }, []);

  const handleEditGroup = useCallback(async (groupId: number) => {
    try {
      // Get tab IDs for this group
      const tabs = await db.activeTabs
        .where("groupId")
        .equals(groupId)
        .toArray();

      const tabIds = tabs
        .map((tab) => tab.id)
        .filter((id): id is number => id !== undefined);

      setGroupDialog({
        open: true,
        groupId,
        tabIds,
      });
    } catch (error) {
      console.error("Failed to open edit group dialog:", error);
    }
  }, []);

  const handleEditGroupConfirm = useCallback(
    async (name: string, color: string) => {
      if (groupDialog.groupId) {
        try {
          const browserColor = hexToBrowserColor(color);
          await browser.runtime.sendMessage({
            type: "updateTabGroup",
            groupId: groupDialog.groupId,
            title: name,
            color: browserColor,
          });
        } catch (error) {
          console.error("Failed to update tab group:", error);
        }
      }
    },
    [groupDialog.groupId],
  );

  const handleEditWorkspace = useCallback(async (workspaceId: number) => {
    try {
      // Get tab IDs for this workspace
      const tabs = await db.activeTabs
        .where("workspaceId")
        .equals(workspaceId)
        .toArray();

      const tabIds = tabs
        .map((tab) => tab.id)
        .filter((id): id is number => id !== undefined);

      setWorkspaceDialog({
        open: true,
        workspaceId,
        tabIds,
      });
    } catch (error) {
      console.error("Failed to open edit workspace dialog:", error);
    }
  }, []);

  const handleEditWorkspaceConfirm = useCallback(
    async (name: string) => {
      if (workspaceDialog.workspaceId) {
        try {
          await db.workspaces.update(workspaceDialog.workspaceId, {
            name,
          });
        } catch (error) {
          console.error("Failed to update workspace:", error);
        }
      }
    },
    [workspaceDialog.workspaceId],
  );

  const handleAICleanConfirm = useCallback(
    async (tabIds: number[], dontAskAgain: boolean) => {
      const workspaceId = shownWorkspaceId;
      if (!workspaceId) {
        console.error("No workspace selected for AI clean");
        return;
      }

      try {
        // Update the global setting if "Don't ask again" was checked
        if (dontAskAgain) {
          updateState("confirmAIClean", false);
        }

        // Send message to background to close the tabs
        const result = await browser.runtime.sendMessage({
          type: "closeTabsByIds",
          workspaceId,
          tabIds,
        });

        if (result?.success) {
          toast.success(
            `Cleaned ${tabIds.length} tab${tabIds.length !== 1 ? "s" : ""} successfully`,
          );
        } else {
          toast.error(result?.error || "Failed to clean tabs");
        }
      } catch (error) {
        console.error("Failed to clean tabs:", error);
        toast.error("Failed to clean tabs");
      }
    },
    [shownWorkspaceId, updateState],
  );

  const handleOpenAICleanReview = useCallback(
    async (tabIds: number[], instructions: string) => {
      // If user has disabled confirmations, proceed directly with cleaning
      if (confirmAIClean === false) {
        await handleAICleanConfirm(tabIds, false);
        return;
      }

      // Otherwise, show the confirmation dialog
      setAiCleanDialog({
        open: true,
        proposedTabIds: tabIds,
        instructions,
      });
    },
    [confirmAIClean, handleAICleanConfirm],
  );

  return (
    <SidebarProvider>
      <AppSidebar
        previewWorkspaceId={previewWorkspaceId}
        setPreviewWorkspaceId={setPreviewWorkspaceId}
        onEditWorkspace={handleEditWorkspace}
        settingsDialogOpen={settingsDialogOpen}
        onSettingsDialogOpenChange={setSettingsDialogOpen}
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

        {/* Command Menu */}
        <CommandMenu
          workspaceId={shownWorkspaceId || null}
          open={commandMenuOpen}
          onOpenChange={setCommandMenuOpen}
          onOpenSettings={() => setSettingsDialogOpen(true)}
          onOpenCreateWorkspace={() => setCreateWorkspaceOpen(true)}
          onOpenAICleanReview={handleOpenAICleanReview}
        />

        <AppContent
          shownWorkspaceId={shownWorkspaceId || null}
          onTabClick={handleTabClick}
          onEditGroup={handleEditGroup}
          // Preview mode is when a specific workspace is selected that differs from the active one
          isPreview={
            previewWorkspaceId !== null &&
            previewWorkspaceId !== workspaceData?.activeWorkspace?.id
          }
          onPreviewTabClick={handlePreviewTabClick}
        />
      </SidebarInset>

      {/* Group Edit Dialog */}
      <GroupDialog
        open={groupDialog.open}
        onOpenChange={(open) => setGroupDialog({ ...groupDialog, open })}
        onConfirm={handleEditGroupConfirm}
        groupId={groupDialog.groupId}
        title="Edit Tab Group"
        description="Edit the group name and color"
        tabIds={groupDialog.tabIds}
      />

      {/* Workspace Edit Dialog */}
      <WorkspaceDialog
        open={workspaceDialog.open}
        onOpenChange={(open) =>
          setWorkspaceDialog({ ...workspaceDialog, open })
        }
        onConfirm={handleEditWorkspaceConfirm}
        workspaceId={workspaceDialog.workspaceId}
        title="Edit Workspace"
        description="Edit the workspace name"
        tabIds={workspaceDialog.tabIds}
      />

      {/* Create Workspace Dialog */}
      <CreateWorkspace
        open={createWorkspaceOpen}
        onOpenChange={setCreateWorkspaceOpen}
        showDefaultTrigger={false}
      />

      {/* AI Clean Dialog */}
      <AICleanDialog
        open={aiCleanDialog.open}
        onOpenChange={(open) => setAiCleanDialog({ ...aiCleanDialog, open })}
        onConfirm={handleAICleanConfirm}
        workspaceId={shownWorkspaceId || null}
        proposedTabIds={aiCleanDialog.proposedTabIds}
        instructions={aiCleanDialog.instructions}
      />
    </SidebarProvider>
  );
}
