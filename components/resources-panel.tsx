"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
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
import type { Resource, ResourceGroup } from "@/lib/types";
import { AddResourceDialog } from "./add-resource-dialog";
import { ResourceGroupComponent } from "./resource-group";
import { ResourceGroupDialog } from "./resource-group-dialog";

interface ResourcesPanelProps {
  resourceGroups: ResourceGroup[];
  resources: Resource[];
  showTags: boolean;
  showUrls: boolean;
}

export function ResourcesPanel({
  resourceGroups: initialGroups,
  resources: initialResources,
  showTags,
  showUrls,
}: ResourcesPanelProps) {
  const [resourceGroups, setResourceGroups] =
    useState<ResourceGroup[]>(initialGroups);
  const [resources, setResources] = useState<Resource[]>(initialResources);
  const [selectedResources, setSelectedResources] = useState<number[]>([]);

  const [groupDialog, setGroupDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    groupId?: number;
    initialName?: string;
    initialDescription?: string;
  }>({
    open: false,
    mode: "create",
  });

  const [resourceDialog, setResourceDialog] = useState<{
    open: boolean;
    groupId?: number;
  }>({
    open: false,
  });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "group" | "resource";
    id?: number;
    name?: string;
  }>({
    open: false,
    type: "group",
  });

  const getResourcesForGroup = (groupId: number) => {
    const group = resourceGroups.find((g) => g.id === groupId);
    if (!group) return [];
    return resources.filter((resource) =>
      group.resourceIds.includes(resource.id.toString()),
    );
  };

  const handleResourceClick = (resource: Resource) => {
    console.log(`Opening resource: ${resource.title}`);
    window.open(resource.url, "_blank");
  };

  const handleStarResource = (id: number, starred: boolean) => {
    console.log(
      `${starred ? "Starring" : "Unstarring"} resource with id: ${id}`,
    );
    // In a real implementation, this would update the resource
  };

  const handleSelectResource = (id: number, selected: boolean) => {
    setSelectedResources((prev) =>
      selected ? [...prev, id] : prev.filter((resId) => resId !== id),
    );
  };

  const handleToggleGroupCollapse = (groupId: number) => {
    setResourceGroups((prevGroups) =>
      prevGroups.map((group) =>
        group.id === groupId
          ? { ...group, collapsed: group.collapsed === 1 ? 0 : 1 }
          : group,
      ),
    );
  };

  const handleOpenCreateGroupDialog = () => {
    setGroupDialog({
      open: true,
      mode: "create",
    });
  };

  const handleOpenEditGroupDialog = (groupId: number) => {
    const group = resourceGroups.find((g) => g.id === groupId);
    if (group) {
      setGroupDialog({
        open: true,
        mode: "edit",
        groupId,
        initialName: group.name,
        initialDescription: group.description,
      });
    }
  };

  const handleCreateGroup = (name: string, description: string) => {
    const timestamp = Date.now();
    const newGroup: ResourceGroup = {
      id: Math.max(...resourceGroups.map((g) => g.id), 0) + 1,
      name,
      description,
      collapsed: 0,
      resourceIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setResourceGroups([...resourceGroups, newGroup]);
  };

  const handleEditGroup = (name: string, description: string) => {
    if (groupDialog.groupId) {
      setResourceGroups((prevGroups) =>
        prevGroups.map((group) =>
          group.id === groupDialog.groupId
            ? {
                ...group,
                name,
                description,
                updatedAt: Date.now(),
              }
            : group,
        ),
      );
    }
  };

  const handleOpenDeleteGroupDialog = (groupId: number) => {
    const group = resourceGroups.find((g) => g.id === groupId);
    if (group) {
      setDeleteDialog({
        open: true,
        type: "group",
        id: groupId,
        name: group.name,
      });
    }
  };

  const handleOpenDeleteResourceDialog = (resourceId: number) => {
    const resource = resources.find((r) => r.id === resourceId);
    if (resource) {
      setDeleteDialog({
        open: true,
        type: "resource",
        id: resourceId,
        name: resource.title,
      });
    }
  };

  const handleConfirmDelete = () => {
    if (deleteDialog.type === "group" && deleteDialog.id) {
      setResourceGroups((prevGroups) =>
        prevGroups.filter((group) => group.id !== deleteDialog.id),
      );
    } else if (deleteDialog.type === "resource" && deleteDialog.id) {
      setResourceGroups((prevGroups) =>
        prevGroups.map((group) => ({
          ...group,
          resourceIds: group.resourceIds.filter(
            (id) => id !== deleteDialog.id?.toString(),
          ),
          updatedAt: Date.now(),
        })),
      );
      setResources((prevResources) =>
        prevResources.filter((resource) => resource.id !== deleteDialog.id),
      );
      setSelectedResources((prev) =>
        prev.filter((id) => id !== deleteDialog.id),
      );
    }
    setDeleteDialog({ ...deleteDialog, open: false });
  };

  const handleOpenAddResourceDialog = (groupId: number) => {
    setResourceDialog({
      open: true,
      groupId,
    });
  };

  const handleAddResource = (
    title: string,
    url: string,
    groupId: number,
    description: string,
    tags: string[],
  ) => {
    const timestamp = Date.now();
    const newResource: Resource = {
      id: Math.max(...resources.map((r) => r.id), 0) + 1,
      title,
      url,
      favIconUrl: "",
      tags,
      description,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setResources([...resources, newResource]);

    setResourceGroups((prevGroups) =>
      prevGroups.map((group) => {
        if (group.id === groupId) {
          return {
            ...group,
            resourceIds: [...group.resourceIds, newResource.id.toString()],
            updatedAt: timestamp,
          };
        }
        return group;
      }),
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-lg">Resources</h2>
        <Button size="sm" onClick={handleOpenCreateGroupDialog}>
          <Plus className="mr-1 h-4 w-4" /> New Group
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-300px)]">
          {resourceGroups.length > 0 ? (
            resourceGroups.map((group) => {
              const groupResources = getResourcesForGroup(group.id);
              return (
                <ResourceGroupComponent
                  key={group.id}
                  group={group}
                  resources={groupResources}
                  selectedResources={selectedResources}
                  showTags={showTags}
                  showUrls={showUrls}
                  onResourceClick={handleResourceClick}
                  onDeleteResource={handleOpenDeleteResourceDialog}
                  onStarResource={handleStarResource}
                  onSelectResource={handleSelectResource}
                  onToggleCollapse={handleToggleGroupCollapse}
                  onEditGroup={handleOpenEditGroupDialog}
                  onDeleteGroup={handleOpenDeleteGroupDialog}
                  onAddResource={handleOpenAddResourceDialog}
                />
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="mb-2 text-muted-foreground">
                No resource groups found
              </p>
              <p className="text-muted-foreground text-sm">
                Create a new group to start organizing your resources.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={handleOpenCreateGroupDialog}
              >
                <Plus className="mr-1 h-4 w-4" /> Create Resource Group
              </Button>
            </div>
          )}
        </ScrollArea>
      </div>

      <ResourceGroupDialog
        open={groupDialog.open}
        onOpenChange={(open) => setGroupDialog({ ...groupDialog, open })}
        onConfirm={
          groupDialog.mode === "create" ? handleCreateGroup : handleEditGroup
        }
        initialName={groupDialog.initialName}
        initialDescription={groupDialog.initialDescription}
        title={
          groupDialog.mode === "create"
            ? "Create Resource Group"
            : "Edit Resource Group"
        }
        description={
          groupDialog.mode === "create"
            ? "Create a new group to organize your resources."
            : "Edit the group name and description."
        }
      />

      <AddResourceDialog
        open={resourceDialog.open}
        onOpenChange={(open) => setResourceDialog({ ...resourceDialog, open })}
        onConfirm={handleAddResource}
        resourceGroups={resourceGroups}
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
