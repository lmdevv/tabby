"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { Minus, Plus } from "lucide-react";
import { UndefinedWorkspaceItem } from "@/components/sidebar/undefined-workspace-item";
import { WorkspaceItem } from "@/components/sidebar/workspace-item";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar";
import { sidebarCache } from "@/lib/db/cache-manager";
import { db } from "@/lib/db/db";
import type { Workspace, WorkspaceGroup } from "@/lib/types/types";

interface WorkspacesProps {
  previewWorkspaceId: number | null;
  setPreviewWorkspaceId: (id: number | null) => void;
  onEditWorkspace?: (id: number) => void;
}

interface WorkspaceGroupItemProps {
  group: WorkspaceGroup;
  workspaces: Workspace[];
  onPreview: (id: number) => void;
  previewWorkspaceId: number | null;
  onEditWorkspace?: (id: number) => void;
}

function WorkspaceGroupItem({
  group,
  workspaces,
  onPreview,
  previewWorkspaceId,
  onEditWorkspace,
}: WorkspaceGroupItemProps) {
  const handleOpenChange = async (open: boolean) => {
    try {
      await db.workspaceGroups.update(group.id, { collapsed: open ? 0 : 1 });
    } catch (error) {
      console.error("Failed to update workspace group collapsed state:", error);
    }
  };

  return (
    <Collapsible
      open={group.collapsed === 0}
      onOpenChange={handleOpenChange}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={group.name} className="relative">
            {group.icon && <div>{group.icon}</div>}
            <span className="flex-1">{group.name}</span>
            <div className="-translate-y-1/2 absolute top-1/2 right-2">
              <Plus className="h-4 w-4 group-data-[state=open]/collapsible:hidden" />
              <Minus className="h-4 w-4 group-data-[state=closed]/collapsible:hidden" />
            </div>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {workspaces.map((workspace) => (
              <WorkspaceItem
                key={workspace.id}
                workspace={workspace}
                onPreview={onPreview}
                isPreviewed={previewWorkspaceId === workspace.id}
                onEdit={onEditWorkspace}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function Workspaces({
  previewWorkspaceId,
  setPreviewWorkspaceId,
  onEditWorkspace,
}: WorkspacesProps) {
  // Get cached sidebar data for instant warm reload
  const cachedSidebarData = sidebarCache.getCachedData();

  const workspaceGroups = useLiveQuery(
    () => {
      const result = db.workspaceGroups.toArray();
      // Update cache with fresh data
      result.then((groups) => {
        const currentCache = sidebarCache.getCachedData() || {};
        sidebarCache.setCachedData({
          ...currentCache,
          workspaceGroups: groups,
        });
      });
      return result;
    },
    [],
    cachedSidebarData?.workspaceGroups,
  );

  const workspaces = useLiveQuery(
    () => {
      const result = db.workspaces.toArray();
      // Update cache with fresh data
      result.then((workspaces) => {
        const currentCache = sidebarCache.getCachedData() || {};
        sidebarCache.setCachedData({ ...currentCache, workspaces });
      });
      return result;
    },
    [],
    cachedSidebarData?.workspaces,
  );

  const undefinedTabsCount = useLiveQuery(
    () => {
      const result = db.activeTabs
        .where("workspaceId")
        .equals(-1)
        .and((tab) => tab.tabStatus === "active")
        .count();
      // Update cache with fresh data
      result.then((count) => {
        const currentCache = sidebarCache.getCachedData() || {};
        sidebarCache.setCachedData({
          ...currentCache,
          undefinedTabsCount: count,
        });
      });
      return result;
    },
    [],
    cachedSidebarData?.undefinedTabsCount,
  );

  const activeWorkspace = useLiveQuery(
    () => {
      const result = db.workspaces.where("active").equals(1).first();
      // Update cache with fresh data
      result.then((workspace) => {
        const currentCache = sidebarCache.getCachedData() || {};
        sidebarCache.setCachedData({
          ...currentCache,
          activeWorkspace: workspace,
        });
      });
      return result;
    },
    [],
    cachedSidebarData?.activeWorkspace,
  );

  const standaloneWorkspaces = workspaces?.filter((w) => !w.groupId) || [];
  const groupedWorkspaces = new Map<number, Workspace[]>();

  if (workspaces) {
    for (const workspace of workspaces) {
      if (workspace.groupId) {
        if (!groupedWorkspaces.has(workspace.groupId)) {
          groupedWorkspaces.set(workspace.groupId, []);
        }
        groupedWorkspaces.get(workspace.groupId)?.push(workspace);
      }
    }
  }

  // Show undefined workspace if there are tabs OR if no workspace is active (meaning undefined workspace is active)
  const isUndefinedWorkspaceActive = !activeWorkspace;
  const shouldShowUndefinedWorkspace =
    typeof undefinedTabsCount === "number" &&
    (undefinedTabsCount > 0 || isUndefinedWorkspaceActive);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
      <SidebarMenu>
        {shouldShowUndefinedWorkspace && (
          <UndefinedWorkspaceItem
            tabsCount={undefinedTabsCount || 0}
            onPreview={() => setPreviewWorkspaceId(-1)}
            isPreviewed={previewWorkspaceId === -1}
          />
        )}
        {workspaceGroups?.map((group) => (
          <WorkspaceGroupItem
            key={group.id}
            group={group}
            workspaces={groupedWorkspaces.get(group.id) || []}
            onPreview={setPreviewWorkspaceId}
            previewWorkspaceId={previewWorkspaceId}
            onEditWorkspace={onEditWorkspace}
          />
        ))}
        {standaloneWorkspaces.map((workspace) => (
          <WorkspaceItem
            key={workspace.id}
            workspace={workspace}
            onPreview={setPreviewWorkspaceId}
            isPreviewed={previewWorkspaceId === workspace.id}
            onEdit={onEditWorkspace}
          />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
