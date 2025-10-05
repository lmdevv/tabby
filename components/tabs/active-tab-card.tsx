import { useLiveQuery } from "dexie-react-hooks";
import { Archive, BookmarkPlus, Star, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { DeleteAction } from "@/components/ui/delete-action";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useResourceGroups, useTabIsResource } from "@/hooks/use-resources";
import { useAppState, useUpdateState } from "@/hooks/use-state";
import { db } from "@/lib/db/db";
import { copySingleTabLink } from "@/lib/helpers/copy-helpers";
import type { ResourceGroup, Tab } from "@/lib/types/types";
import { browserColorToHex, withAlpha } from "@/lib/ui/tab-group-colors";
import { TabCard } from "./tab-card";

interface ActiveTabCardProps {
  tabId: number;
  groupId?: number;
  onClick: () => void;
  onDelete?: (id: number) => void;
  onPin?: (id: number, pinned: boolean) => void;
  onAddToResourceGroup?: (tab: Tab, groupId: number) => void;
  handle?: React.ReactNode;
  isFocused?: boolean;
  isInClipboard?: boolean;
}

export function ActiveTabCard({
  tabId,
  groupId,
  onClick,
  onDelete = () => {},
  onPin: _onPin = () => {},
  onAddToResourceGroup = () => {},
  handle,
  isFocused = false,
  isInClipboard = false,
}: ActiveTabCardProps) {
  // Fetch tab data from DB
  const tab = useLiveQuery(() => db.activeTabs.get(tabId), [tabId]);

  // Fetch global state
  const { data: showTags } = useAppState("showTags");
  const { data: selectedTabs } = useAppState("selectedTabs");
  const { updateState } = useUpdateState();

  // Fetch resource groups
  const resourceGroups = useResourceGroups() ?? [];

  // Fetch tab group info if groupId is provided
  const tabGroupInfo = useLiveQuery(
    () => (groupId ? db.tabGroups.get(groupId) : undefined),
    [groupId],
  );

  const { getResourceGroupsForTab } = useTabIsResource();

  // Calculate derived state
  const isSelected = selectedTabs?.includes(tabId) ?? false;
  const tabGroup = tabGroupInfo
    ? {
        name: tabGroupInfo.title || "Untitled",
        color: tabGroupInfo.color?.startsWith?.("#")
          ? tabGroupInfo.color
          : browserColorToHex(
              tabGroupInfo.color as `${Browser.tabGroups.Color}`,
            ),
      }
    : undefined;

  // Early return if tab not found
  if (!tab) return null;

  const {
    title,
    url,
    favIconUrl,
    pinned,
    audible,
    mutedInfo,
    discarded,
    tags,
  } = tab;

  const resourceGroupsForTab =
    getResourceGroupsForTab({
      title: title || "",
      url: url || "",
    }) || [];
  const hasResourceGroups = resourceGroupsForTab.length > 0;

  // Clamp text lengths for better layout stability
  const MAX_TITLE_CHARS = 90;
  const displayTitleTruncated =
    (title || "Untitled").length > MAX_TITLE_CHARS
      ? `${(title || "Untitled").slice(0, MAX_TITLE_CHARS)}…`
      : title || "Untitled";

  const cardData = {
    title: displayTitleTruncated,
    url,
    favIconUrl,
    tags: undefined, // Always undefined - tags are rendered in afterInfo for custom layout
  };

  const style = tabGroup
    ? {
        borderLeftColor: tabGroup.color,
        backgroundColor: withAlpha(tabGroup.color, 0.06),
      }
    : {};

  return (
    <TabCard
      data={cardData}
      onClick={onClick}
      ariaLabel={`Switch to tab: ${title || "Untitled"}`}
      style={style}
      handle={handle}
      isInteractive={true}
      isFocused={isFocused}
      isInClipboard={isInClipboard}
      beforeFavicon={
        <>
          {/* Add group indicator if tab is part of a group */}
          {tabGroup && (
            <div
              className="-left-0.5 absolute top-0 bottom-0 w-1"
              style={{ backgroundColor: tabGroup.color }}
            />
          )}

          {/* Checkbox for multi-select */}
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => {
              const newSelected =
                checked === true
                  ? [...(selectedTabs ?? []), tabId]
                  : (selectedTabs ?? []).filter((id) => id !== tabId);
              updateState("selectedTabs", newSelected);
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            aria-label={`Select ${title}`}
            className="h-3.5 w-3.5 flex-shrink-0 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
        </>
      }
      afterInfo={
        <>
          {/* Tags */}
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
            </TooltipProvider>
          </div>
        </>
      }
      renderActions={() => (
        <TooltipProvider>
          {resourceGroups.length > 0 ? (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => e.stopPropagation()}
                      title={
                        hasResourceGroups
                          ? "Already saved as resource"
                          : "Add to resource group"
                      }
                      className={
                        hasResourceGroups
                          ? "text-primary hover:text-primary/80"
                          : ""
                      }
                    >
                      <BookmarkPlus
                        className={`h-3 w-3 ${hasResourceGroups ? "text-primary" : ""}`}
                      />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {hasResourceGroups
                      ? `Saved in: ${resourceGroupsForTab.map((g: ResourceGroup) => g.name).join(", ")}`
                      : "Add to resource group"}
                  </p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent>
                <DropdownMenuLabel>
                  {hasResourceGroups
                    ? "Manage resource"
                    : "Add to resource group"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {resourceGroups.map((group) => (
                  <DropdownMenuItem
                    key={group.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToResourceGroup?.(tab, group.id);
                    }}
                  >
                    {group.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.info("No resource groups available");
                  }}
                  title={
                    hasResourceGroups
                      ? "Already saved as resource"
                      : "Add to resource group"
                  }
                  className={
                    hasResourceGroups
                      ? "text-primary hover:text-primary/80"
                      : ""
                  }
                >
                  <BookmarkPlus
                    className={`h-3 w-3 ${hasResourceGroups ? "text-primary" : ""}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {hasResourceGroups
                    ? `Saved in: ${resourceGroupsForTab.map((g) => g.name).join(", ")}`
                    : "Add to resource group"}
                </p>
              </TooltipContent>
            </Tooltip>
          )}

          <DeleteAction
            onDelete={() => {
              if (tab.id !== undefined) {
                onDelete(tab.id);
              }
            }}
            tooltip="Close tab"
            className="h-6 w-6"
            size="sm"
          />
        </TooltipProvider>
      )}
      renderContextMenu={() => (
        <>
          <ContextMenuItem onClick={() => copySingleTabLink(tab)}>
            Copy Link
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={() => tab.id !== undefined && onDelete(tab.id)}
            className="text-destructive"
          >
            Close Tab
          </ContextMenuItem>
        </>
      )}
    />
  );
}
