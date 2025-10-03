"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { BookmarkPlus, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ResourceGroupComponent } from "@/components/resources/resource-group";
import { ResourceGroupDialog } from "@/components/resources/resource-group-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { db } from "@/lib/db";
import {
  createResourceGroup,
  deleteResource,
  deleteResourceGroup,
  updateResourceGroup,
} from "@/lib/resource-helpers";
import type { Resource } from "@/lib/types";

export function ResourcesPanel() {
  // Fetch resource groups directly from database
  const resourceGroups = useLiveQuery(() => db.resourceGroups.toArray(), []);
  const activeTabs = useLiveQuery(() => db.activeTabs.toArray(), []);

  // Handle edit for individual groups
  const handleGroupEdit = async (
    groupId: number,
    _type: "title" | "description",
  ) => {
    const group = await db.resourceGroups.get(groupId);
    if (group) {
      setGroupDialog({
        open: true,
        mode: "edit",
        groupId,
        name: group.name,
        description: group.description || "",
      });
    }
  };

  // Handle delete for individual groups
  const handleGroupDelete = async (groupId: number) => {
    const group = await db.resourceGroups.get(groupId);
    if (group) {
      setDeleteDialog({
        open: true,
        type: "group",
        id: groupId,
        name: group.name,
      });
    }
  };
  const [groupDialog, setGroupDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    groupId?: number;
    name: string;
    description: string;
  }>({
    open: false,
    mode: "create",
    name: "",
    description: "",
  });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "group" | "resource";
    id?: number;
    name?: string;
    groupId?: number;
  }>({
    open: false,
    type: "group",
  });

  const handleResourceClick = (resource: Resource) => {
    console.log(`Opening resource: ${resource.title}`);

    // Check if there's already an active tab with the same URL
    const existingTab = activeTabs?.find((tab) => tab.url === resource.url);
    if (existingTab && existingTab.id !== undefined) {
      try {
        // Switch to existing tab instead of opening new one
        browser.tabs.update(existingTab.id, { active: true });
        if (existingTab.windowId) {
          browser.windows.update(existingTab.windowId, { focused: true });
        }
        console.log(`Switched to existing tab: ${existingTab.title}`);
      } catch (error) {
        console.error("Failed to switch to existing tab:", error);
        // Fallback to opening new tab
        window.open(resource.url, "_blank");
      }
    } else {
      // No existing tab found, open in new tab
      window.open(resource.url, "_blank");
    }
  };

  const handleOpenCreateGroupDialog = () => {
    setGroupDialog({
      open: true,
      mode: "create",
      groupId: undefined,
      name: "",
      description: "",
    });
  };

  const handleCreateGroup = async (name: string, description: string) => {
    try {
      await createResourceGroup(name, description);
      toast.success("Resource group created successfully");
    } catch (error) {
      console.error("Failed to create resource group:", error);
      toast.error("Failed to create resource group");
    }
  };

  const handleEditGroup = async (name: string, description: string) => {
    if (!groupDialog.groupId) return;

    try {
      // Only update fields that are provided (not empty)
      const updates: { name?: string; description?: string } = {};

      if (name.trim()) {
        updates.name = name.trim();
      }

      if (description.trim()) {
        updates.description = description.trim();
      }

      // If description is empty but we have a current group, preserve existing description
      if (!description.trim() && groupDialog.description) {
        updates.description = groupDialog.description;
      }

      await updateResourceGroup(groupDialog.groupId, updates);
      toast.success("Resource group updated successfully");
    } catch (error) {
      console.error("Failed to update resource group:", error);
      toast.error("Failed to update resource group");
    }
  };

  const handleOpenDeleteResourceDialog = async (
    resourceId: number,
    groupId: number,
  ) => {
    const resource = await db.resources.get(resourceId);
    if (resource) {
      setDeleteDialog({
        open: true,
        type: "resource",
        id: resourceId,
        name: resource.title,
        groupId,
      });
    }
  };

  const handleConfirmDelete = async () => {
    try {
      if (deleteDialog.type === "group" && deleteDialog.id) {
        const group = await db.resourceGroups.get(deleteDialog.id);
        const resourceCount = group?.resourceIds?.length || 0;
        await deleteResourceGroup(deleteDialog.id);
        toast.success(
          `Resource group "${deleteDialog.name}" deleted successfully` +
            (resourceCount > 0
              ? ` (${resourceCount} resources also deleted)`
              : ""),
        );
      } else if (deleteDialog.type === "resource" && deleteDialog.id) {
        await deleteResource(deleteDialog.id, deleteDialog.groupId);
        toast.success(`Resource "${deleteDialog.name}" deleted successfully`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to delete: ${errorMessage}`);
    }
    setDeleteDialog({ ...deleteDialog, open: false });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Simple Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">Resources</h2>
        <Button onClick={handleOpenCreateGroupDialog} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          New Group
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-140px)]">
          {resourceGroups && resourceGroups.length > 0 ? (
            <div className="space-y-3">
              {resourceGroups.map((group) => {
                return (
                  <ResourceGroupComponent
                    key={group.id}
                    groupId={group.id}
                    onResourceClick={handleResourceClick}
                    onDeleteResource={(id, gId) =>
                      handleOpenDeleteResourceDialog(id, gId)
                    }
                    onEdit={handleGroupEdit}
                    onDeleteGroup={handleGroupDelete}
                  />
                );
              })}
            </div>
          ) : resourceGroups === undefined ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                <BookmarkPlus className="h-8 w-8 text-muted-foreground animate-pulse" />
              </div>
              <h3 className="mb-2 font-medium text-lg">Loading resources...</h3>
              <p className="mb-6 max-w-sm text-muted-foreground">
                Please wait while we load your resource groups and bookmarks.
              </p>
              <div className="flex space-x-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-bounce"></div>
                <div
                  className="h-2 w-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="h-2 w-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                <BookmarkPlus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 font-medium text-lg">
                No resource groups yet
              </h3>
              <p className="mb-6 max-w-sm text-muted-foreground">
                Create your first resource group to start organizing your
                bookmarks and saved tabs.
              </p>
              <Button onClick={handleOpenCreateGroupDialog} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Resource Group
              </Button>
            </div>
          )}
        </ScrollArea>
      </div>

      <ResourceGroupDialog
        key={groupDialog.groupId || "create"}
        open={groupDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setGroupDialog({
              open: false,
              mode: "create",
              name: "",
              description: "",
            });
          } else {
            setGroupDialog({ ...groupDialog, open });
          }
        }}
        onConfirm={
          groupDialog.mode === "create" ? handleCreateGroup : handleEditGroup
        }
        mode={groupDialog.mode}
        initialName={groupDialog.name}
        initialDescription={groupDialog.description}
      />

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialog.type === "group"
                ? "Delete Resource Group"
                : "Delete Resource"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.type === "group"
                ? `Are you sure you want to delete the group "${deleteDialog.name}"? This will remove all resources from this group.`
                : `Are you sure you want to delete the resource "${deleteDialog.name}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
