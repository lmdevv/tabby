"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { BookmarkPlus, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { ResourceCard } from "@/components/resources/resource-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { db } from "@/lib/db";
import type { Resource } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ResourceGroupProps {
  groupId: number;
  onResourceClick: (resource: Resource) => void;
  onDeleteResource: (id: number, groupId: number) => void;
  onEdit?: (groupId: number, type: "title" | "description") => void;
  onDeleteGroup?: (groupId: number) => void;
}

export function ResourceGroupComponent({
  groupId,
  onResourceClick,
  onDeleteResource,
  onEdit,
  onDeleteGroup,
}: ResourceGroupProps) {
  // Fetch data directly from database
  const group = useLiveQuery(() => db.resourceGroups.get(groupId), [groupId]);
  const resources = useLiveQuery(() => {
    if (!group?.resourceIds?.length) return [];
    return db.resources
      .where("id")
      .anyOf(group.resourceIds.map((id) => parseInt(id, 10)))
      .toArray();
  }, [group?.resourceIds]);

  // Don't render if group data hasn't loaded yet
  if (!group || !resources) {
    return null;
  }

  const isOpen = group.collapsed === 0;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(open) => {
        // Update DB state when collapsible changes
        if (group) {
          db.resourceGroups.update(group.id, { collapsed: open ? 0 : 1 });
        }
      }}
      className="flex w-full flex-col gap-2 group"
    >
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between gap-4 px-4 py-2 rounded-md cursor-pointer transition-colors">
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <h4 className="text-sm font-semibold">{group.name}</h4>
            <Badge variant="secondary" className="shrink-0">
              {resources.length}
            </Badge>
            {group.description && (
              <p className="text-sm text-muted-foreground">
                {group.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(group.id, group.description ? "description" : "title");
                }}
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Button>
            )}

            {onDeleteGroup && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteGroup(group.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete group</span>
              </Button>
            )}

            <div className="size-8 flex items-center justify-center text-muted-foreground">
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isOpen && "rotate-180",
                )}
              />
              <span className="sr-only">Toggle</span>
            </div>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="flex flex-col gap-2">
        {resources.length > 0 ? (
          <div className="grid gap-2">
            {resources.map((resource) => (
              <ResourceCard
                key={resource.id}
                resourceId={resource.id}
                onClick={() => onResourceClick(resource)}
                onDelete={(id) => onDeleteResource(id, group.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
              <BookmarkPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No resources in this group yet
            </p>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
