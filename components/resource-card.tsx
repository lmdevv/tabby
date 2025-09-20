import { ExternalLink, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Resource } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ResourceCardProps {
  resource: Resource;
  onClick: () => void;
  onDelete?: (id: number) => void;
  onStar?: (id: number, starred: boolean) => void;
  showTags: boolean;
  showUrl: boolean;
  isSelected?: boolean;
  onSelectChange?: (id: number, selected: boolean) => void;
}

export function ResourceCard({
  resource,
  onClick,
  onDelete = () => {},
  onStar = () => {},
  showTags,
  showUrl,
  isSelected = false,
  onSelectChange = () => {},
}: ResourceCardProps) {
  const { title, url, favIconUrl, tags, description } = resource;

  // Format the URL for display
  const displayUrl = url
    ? url.replace(/^https?:\/\//, "").replace(/^www\./, "")
    : "No URL";

  // Determine the domain for a fallback icon
  const domain = url ? new URL(url).hostname : "";
  const domainInitial = domain.charAt(0).toUpperCase() || "?";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Button
          asChild
          variant="ghost"
          className={cn(
            "flex w-full items-center rounded-md border border-transparent p-2 text-left",
            "transition-all duration-200 hover:border-accent hover:bg-accent/50",
            "group relative cursor-pointer select-none",
          )}
        >
          {/* biome-ignore lint/a11y/useSemanticElements: Non-button wrapper avoids nested buttons */}
          <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }}
            aria-label={`Open resource: ${title || "Unknown"}`}
          >
            <div className="flex w-full items-center gap-2">
              {/* Checkbox for multi-select */}
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => {
                  onSelectChange(resource.id, checked === true);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                aria-label={`Select ${title}`}
                className="h-3.5 w-3.5 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
              />

              {/* Favicon */}
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                {favIconUrl ? (
                  <img
                    src={favIconUrl || "/placeholder.svg"}
                    alt=""
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      const nextSibling =
                        target.nextElementSibling as HTMLElement;
                      if (nextSibling) {
                        nextSibling.style.display = "flex";
                      }
                    }}
                  />
                ) : null}
                <div
                  className={`flex h-full w-full items-center justify-center bg-primary/10 font-semibold text-primary text-xs ${favIconUrl ? "hidden" : ""}`}
                >
                  {domainInitial}
                </div>
              </div>

              {/* Resource info */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="truncate font-medium text-sm" title={title}>
                    {title}
                  </h3>
                  {showTags && tags && tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="h-5 px-1.5 py-0.5 text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {showUrl && (
                  <p
                    className="mt-0.5 truncate text-muted-foreground text-xs"
                    title={url}
                  >
                    {displayUrl}
                  </p>
                )}
                {description && (
                  <p
                    className="mt-0.5 truncate text-muted-foreground text-xs"
                    title={description}
                  >
                    {description}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="ml-auto flex flex-shrink-0 items-center gap-0.5">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="rounded-full p-0.5 opacity-0 transition-all hover:bg-muted group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (url) {
                            window.open(url, "_blank");
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            if (url) {
                              window.open(url, "_blank");
                            }
                          }
                        }}
                        title="Open in new tab"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Open in new tab</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="rounded-full p-0.5 opacity-0 transition-all hover:bg-muted group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(resource.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete(resource.id);
                          }
                        }}
                        title="Delete resource"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete resource</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </Button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => window.open(url, "_blank")}>
          Open in New Tab
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onStar(resource.id, true)}>
          Star Resource
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => onDelete(resource.id)}
          className="text-destructive"
        >
          Delete Resource
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
