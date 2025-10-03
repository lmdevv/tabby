import { useLiveQuery } from "dexie-react-hooks";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppState } from "@/hooks/use-state";
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

  // Format the URL for display
  const displayUrl = url
    ? url.replace(/^https?:\/\//, "").replace(/^www\./, "")
    : "No URL";

  // Clamp text lengths for better layout stability
  const MAX_TITLE_CHARS = 90;
  const MAX_URL_CHARS = 80;
  const displayTitleTruncated =
    (title || "Untitled").length > MAX_TITLE_CHARS
      ? `${(title || "Untitled").slice(0, MAX_TITLE_CHARS)}…`
      : title || "Untitled";
  const displayUrlTruncated =
    displayUrl.length > MAX_URL_CHARS
      ? `${displayUrl.slice(0, MAX_URL_CHARS)}…`
      : displayUrl;

  // Determine the domain for a fallback icon
  const domain = url ? new URL(url).hostname : "";
  const domainInitial = domain.charAt(0).toUpperCase() || "?";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/* biome-ignore lint/a11y/useSemanticElements: ContextMenuTrigger requires div wrapper */}
        <div
          role="button"
          tabIndex={0}
          className="flex h-auto w-full items-center justify-start rounded-lg border border-transparent p-2 text-left transition-all duration-200 hover:border-accent hover:bg-accent/50 hover:shadow-sm group relative cursor-pointer select-none gap-3"
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick();
            }
          }}
          aria-label={`Open resource "${displayTitleTruncated || "Unknown"}" ${isActive ? "(currently active)" : ""} ${url ? `from ${url}` : ""}`}
        >
          {/* Favicon */}
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted shadow-sm">
            {favIconUrl ? (
              <img
                src={favIconUrl || "/placeholder.svg"}
                alt=""
                className="h-full w-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  const nextSibling = target.nextElementSibling as HTMLElement;
                  if (nextSibling) {
                    nextSibling.style.display = "flex";
                  }
                }}
              />
            ) : null}
            <div
              className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10 font-semibold text-primary text-sm ${favIconUrl ? "hidden" : ""}`}
            >
              {domainInitial}
            </div>
          </div>

          {/* Resource info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3
                    className="truncate font-medium text-sm leading-tight"
                    title={title}
                  >
                    {displayTitleTruncated}
                  </h3>
                  {/* Active indicator */}
                  {isActive && (
                    <span
                      className="h-2 w-2 rounded-full bg-primary flex-shrink-0 block"
                      title="Currently active"
                      aria-hidden="true"
                    />
                  )}
                </div>
                {(showUrl ?? true) && (
                  <p
                    className="mt-1 truncate text-muted-foreground text-xs"
                    title={url}
                  >
                    {displayUrlTruncated}
                  </p>
                )}
                {description && (
                  <p
                    className="mt-1 truncate text-muted-foreground text-xs"
                    title={description}
                  >
                    {description}
                  </p>
                )}
              </div>

              {/* Tags and metadata */}
              {(showTags ?? true) && tags && tags.length > 0 && (
                <div className="flex flex-wrap gap-1 sm:justify-end">
                  {tags.slice(0, 2).map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="h-5 px-1.5 py-0.5 text-xs"
                    >
                      {tag}
                    </Badge>
                  ))}
                  {tags.length > 2 && (
                    <Badge
                      variant="secondary"
                      className="h-5 px-1.5 py-0.5 text-xs"
                    >
                      +{tags.length - 2}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="ml-auto flex flex-shrink-0 items-center gap-1">
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
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => window.open(url, "_blank")}>
          Open in New Tab
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onDelete(resource.id)}>
          Delete Resource
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
