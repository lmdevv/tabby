"use client";

import { BookmarkPlus } from "lucide-react";
import { ResourceCard } from "@/components/resources/resource-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { normalizeUrl } from "@/lib/resource-helpers";
import type { Resource, ResourceGroup, Tab } from "@/lib/types";

interface ResourceGroupProps {
  group: ResourceGroup;
  resources: Resource[];
  showTags: boolean;
  showUrls: boolean;
  onResourceClick: (resource: Resource) => void;
  onDeleteResource: (id: number, groupId: number) => void;
  onStarResource: (id: number, starred: boolean) => void;
  isOpen: boolean;
  onToggle: (groupId: number) => void;
  activeTabs?: Tab[];
}

export function ResourceGroupComponent({
  group,
  resources,
  showTags,
  showUrls,
  onResourceClick,
  onDeleteResource,
  onStarResource,
  isOpen,
  onToggle,
  activeTabs = [],
}: ResourceGroupProps) {
  // Check if a resource is currently active
  const isResourceActive = (resource: Resource) => {
    return activeTabs.some((activeTab) => {
      if (!activeTab.url || !resource.url) return false;
      return normalizeUrl(activeTab.url) === normalizeUrl(resource.url);
    });
  };

  return (
    <div className="w-full">
      <Accordion
        type="single"
        collapsible
        value={isOpen ? `group-${group.id}` : undefined}
      >
        <AccordionItem value={`group-${group.id}`}>
          <AccordionTrigger
            className="flex w-full items-center justify-between p-4 text-left hover:no-underline"
            onClick={() => onToggle(group.id)}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <h3 className="font-medium text-sm truncate">{group.name}</h3>
              <Badge variant="secondary" className="shrink-0">
                {resources.length}
              </Badge>
              {group.description && (
                <p
                  className="text-xs text-muted-foreground truncate ml-auto max-w-[200px]"
                  title={group.description}
                >
                  {group.description}
                </p>
              )}
            </div>
          </AccordionTrigger>

          <AccordionContent className="px-4 pb-4">
            {resources.length > 0 ? (
              <div className="grid gap-2">
                {resources.map((resource) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    onClick={() => onResourceClick(resource)}
                    onDelete={(id) => onDeleteResource(id, group.id)}
                    onStar={onStarResource}
                    showTags={showTags}
                    showUrl={showUrls}
                    isActive={isResourceActive(resource)}
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
