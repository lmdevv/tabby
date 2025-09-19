"use client";

import {
  ChevronDown,
  ChevronRight,
  Edit,
  PlusCircle,
  Trash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Resource, ResourceGroup } from "@/lib/types";
import { ResourceCard } from "./resource-card";

interface ResourceGroupProps {
  group: ResourceGroup;
  resources: Resource[];
  selectedResources: number[];
  showTags: boolean;
  showUrls: boolean;
  onResourceClick: (resource: Resource) => void;
  onDeleteResource: (id: number) => void;
  onStarResource: (id: number, starred: boolean) => void;
  onSelectResource: (id: number, selected: boolean) => void;
  onToggleCollapse: (groupId: number) => void;
  onEditGroup: (groupId: number) => void;
  onDeleteGroup: (groupId: number) => void;
  onAddResource: (groupId: number) => void;
}

export function ResourceGroupComponent({
  group,
  resources,
  selectedResources,
  showTags,
  showUrls,
  onResourceClick,
  onDeleteResource,
  onStarResource,
  onSelectResource,
  onToggleCollapse,
  onEditGroup,
  onDeleteGroup,
  onAddResource,
}: ResourceGroupProps) {
  const isCollapsed = group.collapsed === 1;

  return (
    <div className="mb-2">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center justify-between rounded-md border-transparent p-2 transition-all duration-200 hover:border-accent hover:bg-accent/50"
            onClick={() => onToggleCollapse(group.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggleCollapse(group.id);
              }
            }}
            aria-label={`${isCollapsed ? "Expand" : "Collapse"} resource group ${group.name}`}
          >
            <div className="flex items-center gap-2">
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              <span className="font-medium text-sm">{group.name}</span>
              <span className="text-muted-foreground text-xs">
                ({resources.length})
              </span>
            </div>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddResource(group.id);
                }}
                className="rounded-full p-1 hover:bg-accent"
              >
                <PlusCircle className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditGroup(group.id);
                }}
                className="rounded-full p-1 hover:bg-accent"
              >
                <Edit className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteGroup(group.id);
                }}
                className="rounded-full p-1 hover:bg-accent"
              >
                <Trash className="h-3 w-3" />
              </button>
            </div>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onEditGroup(group.id)}>
            Edit Group
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onToggleCollapse(group.id)}>
            {isCollapsed ? "Expand" : "Collapse"} Group
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onAddResource(group.id)}>
            Add Resource
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onDeleteGroup(group.id)}
            className="text-destructive"
          >
            Delete Group
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {!isCollapsed && (
        <div className="mt-1 space-y-1 pl-6">
          {resources.length > 0 ? (
            resources.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                onClick={() => onResourceClick(resource)}
                onDelete={onDeleteResource}
                onStar={onStarResource}
                showTags={showTags}
                showUrl={showUrls}
                isSelected={selectedResources.includes(resource.id)}
                onSelectChange={onSelectResource}
              />
            ))
          ) : (
            <div className="py-2 text-center text-muted-foreground text-sm">
              <p>No resources in this group</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1"
                onClick={() => onAddResource(group.id)}
              >
                <PlusCircle className="mr-1 h-4 w-4" /> Add Resource
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
