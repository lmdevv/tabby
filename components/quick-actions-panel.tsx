"use client";

import { Layers, Star, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuickActionsPanelProps {
  selectedTabsCount: number;
  allPinned: boolean;
  allMuted: boolean;
  allHighlighted: boolean;
  canGroup: boolean;
  canUngroup: boolean;
  onCloseTabs: () => void;
  onTogglePinTabs: () => void;
  onToggleMuteTabs: () => void;
  onToggleHighlightTabs: () => void;
  onGroupTabs: () => void;
  onUngroupTabs: () => void;
}

export function QuickActionsPanel({
  selectedTabsCount,
  allPinned: _allPinned,
  allMuted,
  allHighlighted,
  canGroup,
  canUngroup,
  onCloseTabs,
  onTogglePinTabs: _onTogglePinTabs,
  onToggleMuteTabs,
  onToggleHighlightTabs,
  onGroupTabs,
  onUngroupTabs,
}: QuickActionsPanelProps) {
  if (selectedTabsCount === 0) return null;

  return (
    <div className="-translate-x-1/2 fixed bottom-8 left-1/2 z-10 rounded-full border border-border/40 bg-background/90 p-2 shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-2 px-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={onCloseTabs}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close Tabs</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={onToggleMuteTabs}
              >
                {allMuted ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {allMuted ? "Unmute Tabs" : "Mute Tabs"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={onToggleHighlightTabs}
              >
                <Star
                  className={`h-4 w-4 ${allHighlighted ? "fill-yellow-500" : ""}`}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {allHighlighted ? "Unhighlight Tabs" : "Highlight Tabs"}
            </TooltipContent>
          </Tooltip>

          {canGroup && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={onGroupTabs}
                >
                  <Layers className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Group Tabs</TooltipContent>
            </Tooltip>
          )}

          {canUngroup && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={onUngroupTabs}
                >
                  <Layers className="h-4 w-4 opacity-50" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ungroup Tabs</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    </div>
  );
}
