"use client";
import { CirclePlus, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { browser } from "wxt/browser";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { CreateWorkspace } from "./create-workspace";

interface UndefinedWorkspaceItemProps {
  tabsCount: number;
  onPreview?: () => void;
  isPreviewed?: boolean;
}

export function UndefinedWorkspaceItem({
  tabsCount,
  onPreview,
  isPreviewed = false,
}: UndefinedWorkspaceItemProps) {
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    try {
      // Get all tabs that belong to the undefined workspace (-1)
      const undefinedTabs = await db.activeTabs
        .where("workspaceId")
        .equals(-1)
        .toArray();

      // Extract tab IDs that have valid browser tab IDs
      const tabIdsToClose = undefinedTabs
        .map((tab) => tab.id)
        .filter((id): id is number => id != null);

      // Close the browser tabs - this will trigger the tab listeners
      // which will automatically remove them from the database
      if (tabIdsToClose.length > 0) {
        await browser.tabs.remove(tabIdsToClose);
      }
    } catch (error) {
      console.error("Error closing undefined tabs:", error);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false);
    await handleDelete();
  };

  const handleWorkspaceCreated = async (workspaceId: number) => {
    try {
      await db.activeTabs
        .where("workspaceId")
        .equals(-1)
        .modify({ workspaceId });

      // Automatically activate and switch to the newly created workspace
      // Use skipTabSwitching to prevent unnecessary tab close/open cycles
      await browser.runtime.sendMessage({
        type: "openWorkspace",
        workspaceId: workspaceId,
        skipTabSwitching: true,
      });
    } catch (error) {
      console.error("Error moving tabs to workspace:", error);
    }
  };

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          className={`opacity-50 ${isPreviewed ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : ""}`}
          onClick={onPreview}
        >
          <span>
            Undefined Workspace{tabsCount > 0 ? ` (${tabsCount} tabs)` : ""}
          </span>
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
            <DropdownMenuItem onClick={() => setOpen(true)}>
              <CirclePlus className="text-muted-foreground" />
              <span>New Workspace</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDeleteClick}>
              <Trash2 className="text-muted-foreground" />
              <span>Delete Tabs</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <CreateWorkspace
        open={open}
        onOpenChange={setOpen}
        onWorkspaceCreated={handleWorkspaceCreated}
        showDefaultTrigger={false}
      />

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tabsCount > 0 ? "Delete All Tabs?" : "Close Workspace?"}
            </DialogTitle>
            <DialogDescription>
              {tabsCount > 0
                ? `This action will close all ${tabsCount} tabs in the undefined workspace. This means all your current browser tabs will be closed permanently. This action cannot be undone.`
                : "This action will close the undefined workspace. No tabs will be affected since there are currently no tabs open."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              {tabsCount > 0 ? "Delete All Tabs" : "Close Workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
