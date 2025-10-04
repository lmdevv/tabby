import { useLiveQuery } from "dexie-react-hooks";
import { X } from "lucide-react";
import { BaseCard } from "@/components/ui/base-card";
import { Button } from "@/components/ui/button";
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppState } from "@/hooks/use-state";
import { truncateText } from "@/lib/card-helpers";
import { db } from "@/lib/db";
import { normalizeUrl } from "@/lib/resource-helpers";

interface ResourceCardProps {
  resourceId: number;
  onClick: () => void;
  onDelete?: (id: number) => void;
}

export function ResourceCard({
  resourceId,
  onClick,
  onDelete = () => {},
}: ResourceCardProps) {
  // Get UI state from global state (must be called before any early returns)
  const { data: showTags } = useAppState("showTags");
  const { data: showUrl } = useAppState("showUrls");

  // Fetch resource data directly from database
  const resource = useLiveQuery(
    () => db.resources.get(resourceId),
    [resourceId],
  );

  // Fetch active tabs to determine if this resource is currently active
  const activeTabs = useLiveQuery(() => db.activeTabs.toArray(), []);

  // Don't render if resource data hasn't loaded yet
  if (!resource) {
    return null;
  }

  const { title, url, favIconUrl, tags, description } = resource;

  // Check if this resource is currently active
  const isActive =
    activeTabs?.some((activeTab) => {
      if (!activeTab.url || !resource.url) return false;
      return normalizeUrl(activeTab.url) === normalizeUrl(resource.url);
    }) || false;

  const displayTitle = title || "Untitled";
  const displayDescription = description ? truncateText(description, 80) : null;

  const cardData = {
    title: displayTitle,
    url,
    favIconUrl,
    tags,
  };

  const ariaLabel = `Open resource "${displayTitle}" ${isActive ? "(currently active)" : ""} ${url ? `from ${url}` : ""}`;

  return (
    <BaseCard
      data={cardData}
      showUrl={showUrl ?? true}
      showTags={showTags ?? true}
      onClick={onClick}
      ariaLabel={ariaLabel}
      afterTitle={
        isActive ? (
          <span
            className="h-2 w-2 rounded-full bg-primary flex-shrink-0 block"
            title="Currently active"
            aria-hidden="true"
          />
        ) : undefined
      }
      afterInfo={
        displayDescription ? (
          <p
            className="mt-1 truncate text-muted-foreground text-xs"
            title={description}
          >
            {displayDescription}
          </p>
        ) : undefined
      }
      renderActions={() => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full opacity-0 transition-all hover:bg-muted group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(resource.id);
                }}
                title="Delete resource"
              >
                <X className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Delete resource</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      renderContextMenu={() => (
        <>
          <ContextMenuItem onClick={() => window.open(url, "_blank")}>
            Open in New Tab
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onDelete(resource.id)}>
            Delete Resource
          </ContextMenuItem>
        </>
      )}
    />
  );
}
