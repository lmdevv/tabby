import { Archive, Star, Volume2, VolumeX, X } from "lucide-react";
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
import { withAlpha } from "@/lib/tab-group-colors";
import type { Tab } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TabCardProps {
  tab: Tab;
  onClick: () => void;
  onDelete?: (id: number) => void;
  onPin?: (id: number, pinned: boolean) => void;
  onMute?: (id: number, muted: boolean) => void;
  onHighlight?: (id: number, highlighted: boolean) => void;
  showTags: boolean;
  showUrl: boolean;
  isSelected?: boolean;
  onSelectChange?: (id: number, selected: boolean) => void;
  tabGroup?: { name: string; color: string } | undefined;
}

export function TabCard({
  tab,
  onClick,
  onDelete = () => {},
  onPin: _onPin = () => {},
  onMute = () => {},
  onHighlight = () => {},
  showTags,
  showUrl,
  isSelected = false,
  onSelectChange = () => {},
  tabGroup,
}: TabCardProps) {
  const {
    title,
    url,
    favIconUrl,
    pinned,
    audible,
    mutedInfo,
    highlighted,
    discarded,
    tags,
  } = tab;

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
          variant="ghost"
          className={cn(
            "flex h-auto w-full items-center justify-start rounded-md border border-transparent p-2 text-left",
            "transition-all duration-200 hover:border-accent hover:bg-accent/50",
            "group relative",
            tabGroup ? "border-l-4" : "",
          )}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick();
            }
          }}
          aria-label={`Switch to tab: ${title || "Untitled"}`}
          style={
            tabGroup
              ? {
                  borderLeftColor: tabGroup.color,
                  backgroundColor: withAlpha(tabGroup.color, 0.06),
                }
              : {}
          }
        >
          {/* Add group indicator if tab is part of a group */}
          {tabGroup && (
            <div
              className="-left-0.5 absolute top-0 bottom-0 w-1"
              style={{ backgroundColor: tabGroup.color }}
            />
          )}

          <div className="flex w-full items-center gap-2">
            {/* Checkbox for multi-select */}
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => {
                if (tab.id !== undefined) {
                  onSelectChange(tab.id, checked === true);
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
              aria-label={`Select ${title}`}
              className="h-3.5 w-3.5 flex-shrink-0 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
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

            {/* Tab info */}
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
            </div>

            {/* Status indicators */}
            <div className="ml-auto flex flex-shrink-0 items-center gap-0.5">
              <TooltipProvider>
                {audible && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="rounded-full bg-background/80 p-0.5">
                        <Volume2 className="h-3 w-3 text-green-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Playing audio</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {mutedInfo?.muted && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="rounded-full bg-background/80 p-0.5">
                        <VolumeX className="h-3 w-3 text-red-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Muted</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {pinned && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="rounded-full bg-background/80 p-0.5">
                        <Star className="h-3 w-3 text-yellow-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Pinned</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {discarded && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="rounded-full bg-background/80 p-0.5">
                        <Archive className="h-3 w-3 text-gray-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Discarded</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (tab.id !== undefined) {
                          onDelete(tab.id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          if (tab.id !== undefined) {
                            onDelete(tab.id);
                          }
                        }
                      }}
                      title="Close tab"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Close tab</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </Button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() =>
            tab.id !== undefined && onMute(tab.id, !mutedInfo?.muted)
          }
        >
          {mutedInfo?.muted ? "Unmute" : "Mute"} Tab
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() =>
            tab.id !== undefined && onHighlight(tab.id, !highlighted)
          }
        >
          {highlighted ? "Remove Highlight" : "Highlight"} Tab
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          onClick={() => tab.id !== undefined && onDelete(tab.id)}
          className="text-destructive"
        >
          Close Tab
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
