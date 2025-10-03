"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Copy, Layers, Star, Volume2, VolumeX, X } from "lucide-react";
import type { Browser } from "wxt/browser";
import { browser } from "wxt/browser";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppState, useUpdateState } from "@/hooks/use-state";
import { db } from "@/lib/db";

export function QuickActionsPanel() {
  const { data: selectedTabsData } = useAppState("selectedTabs");
  const { updateState } = useUpdateState();

  const currentSelectedTabs = (selectedTabsData as number[]) ?? [];

  const handleSelectionCleared = () => {
    updateState("selectedTabs", []);
  };

  // Get active workspace
  const activeWorkspace = useLiveQuery(() =>
    db.workspaces.where("active").equals(1).first(),
  );

  // Get selected tab data
  const selectedTabData = useLiveQuery(() => {
    if (!currentSelectedTabs.length || !activeWorkspace) return [];
    return db.activeTabs
      .where("id")
      .anyOf(currentSelectedTabs)
      .and((tab) => tab.workspaceId === activeWorkspace.id)
      .toArray();
  }, [currentSelectedTabs, activeWorkspace]);

  // Calculate derived state
  const currentSelectedTabsCount = currentSelectedTabs.length;
  const allMuted =
    selectedTabData?.every(
      (tab) => (tab as Browser.tabs.Tab).mutedInfo?.muted,
    ) ?? false;
  const allHighlighted =
    selectedTabData?.every((tab) => (tab as Browser.tabs.Tab).highlighted) ??
    false;
  const canGroup = currentSelectedTabs.length > 1; // Can group if more than one tab selected
  const canUngroup =
    selectedTabData?.some((tab) => tab.groupId !== undefined) ?? false;

  // Action handlers
  const handleCloseTabs = async () => {
    if (!currentSelectedTabs.length) return;
    try {
      await browser.tabs.remove(currentSelectedTabs);
      handleSelectionCleared();
    } catch (error) {
      console.error("Failed to close tabs:", error);
    }
  };

  const handleToggleMuteTabs = async () => {
    if (!selectedTabData?.length) return;
    try {
      const newMutedState = !allMuted;
      await Promise.all(
        currentSelectedTabs.map((tabId) =>
          browser.tabs.update(tabId, { muted: newMutedState }),
        ),
      );
    } catch (error) {
      console.error("Failed to toggle mute tabs:", error);
    }
  };

  const handleToggleHighlightTabs = async () => {
    if (!selectedTabData?.length) return;
    try {
      const newHighlightedState = !allHighlighted;
      await Promise.all(
        currentSelectedTabs.map((tabId) =>
          browser.tabs.update(tabId, { highlighted: newHighlightedState }),
        ),
      );
    } catch (error) {
      console.error("Failed to toggle highlight tabs:", error);
    }
  };

  const handleGroupTabs = async () => {
    if (!currentSelectedTabs.length || !activeWorkspace) return;
    try {
      if (typeof browser?.tabs?.group === "function") {
        await browser.tabs.group({
          tabIds: currentSelectedTabs as [number, ...number[]],
          createProperties: {
            windowId: selectedTabData?.[0]?.windowId,
          },
        });
      }
    } catch (error) {
      console.error("Failed to group tabs:", error);
    }
  };

  const handleUngroupTabs = async () => {
    if (!currentSelectedTabs.length) return;
    try {
      if (typeof browser?.tabs?.ungroup === "function") {
        await browser.tabs.ungroup(
          currentSelectedTabs as [number, ...number[]],
        );
      }
    } catch (error) {
      console.error("Failed to ungroup tabs:", error);
    }
  };

  const handleCopyLinks = async () => {
    if (!selectedTabData?.length) return;
    try {
      const links = selectedTabData
        .map((tab) => tab.url)
        .filter(Boolean)
        .join("\n");
      await navigator.clipboard.writeText(links);
    } catch (error) {
      console.error("Failed to copy links:", error);
    }
  };

  if (currentSelectedTabsCount === 0) return null;

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
                onClick={handleCopyLinks}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Copy Link{currentSelectedTabsCount > 1 ? "s" : ""}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={handleCloseTabs}
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
                onClick={handleToggleMuteTabs}
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
                onClick={handleToggleHighlightTabs}
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
                  onClick={handleGroupTabs}
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
                  onClick={handleUngroupTabs}
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
