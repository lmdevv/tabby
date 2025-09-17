"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { db } from "@/entrypoints/background/db";
import type { Workspace } from "@/lib/types";
import { Folder, MoreHorizontal, Trash2 } from "lucide-react";

interface WorkspaceItemProps {
  workspace: Workspace;
  isActive?: boolean;
  onPreview?: (id: number) => void;
  isPreviewed?: boolean;
}

export function WorkspaceItem({
  workspace,
  isActive = false,
  onPreview,
  isPreviewed = false,
}: WorkspaceItemProps) {
  const handleDelete = async () => {
    try {
      await db.transaction("rw", db.workspaces, db.activeTabs, async () => {
        // 1. Check if deleting the active workspace
        const isActive = workspace.active === 1;

        // 2. Delete the workspace
        await db.workspaces.delete(workspace.id);

        // 3. If it was active, find and activate the most recent workspace
        if (isActive) {
          const nextWorkspace = await db.workspaces
            .orderBy("lastOpened")
            .reverse()
            .first();

          if (nextWorkspace) {
            await db.workspaces.update(nextWorkspace.id, {
              active: 1,
            });
          }
        }

        // 4. Clean up associated tabs (set workspaceId to -1)
        await db.activeTabs.where("workspaceId").equals(workspace.id).modify({
          workspaceId: -1,
          tabStatus: "archived",
        });
      });
    } catch (error) {
      console.error("Error deleting workspace:", error);
    }
  };

  const handleActivate = async () => {
    try {
      await db.transaction("rw", db.workspaces, db.activeTabs, async () => {
        // Deactivate all workspaces first
        await db.workspaces.where("active").equals(1).modify({ active: 0 });

        // Activate current workspace
        await db.workspaces.update(workspace.id, {
          active: 1,
          lastOpened: Date.now(),
        });

        // Archive all active tabs
        await db.activeTabs
          .where("tabStatus")
          .equals("active")
          .modify({ tabStatus: "archived" });

        // Activate workspace tabs
        await db.activeTabs
          .where("workspaceId")
          .equals(workspace.id)
          .modify({ tabStatus: "active" });
      });
    } catch (error) {
      console.error("Error activating workspace:", error);
    }
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={onPreview ? () => onPreview(workspace.id) : undefined}
        isActive={isPreviewed || isActive || workspace.active === 1}
      >
        <span>{workspace.name}</span>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover>
            <MoreHorizontal />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-48 rounded-lg"
          side="right"
          align="start"
        >
          <DropdownMenuItem
            onClick={async () => {
              await handleActivate();
              if (onPreview) onPreview(workspace.id);
            }}
          >
            <Folder className="text-muted-foreground" />
            <span>Activate Workspace</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDelete}>
            <Trash2 className="text-muted-foreground" />
            <span>Delete Workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
