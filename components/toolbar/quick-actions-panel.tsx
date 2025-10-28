"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Copy, Folder, Layers, X } from "lucide-react";
import { useState } from "react";
import { browser } from "wxt/browser";
import { CommandMenu } from "@/components/command-menu/command-menu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppState, useUpdateState } from "@/hooks/use-state";
import { db } from "@/lib/db/db";
import { copyMultipleTabLinks } from "@/lib/helpers/copy-helpers";
import { addTabsToResourceGroup } from "@/lib/helpers/resource-helpers";
import { groupTabs } from "@/lib/helpers/tab-helpers";

export function QuickActionsPanel() {
  const { data: selectedTabsData } = useAppState("selectedTabs");
  const { updateState } = useUpdateState();
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);

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
  const canGroup = currentSelectedTabs.length > 1; // Can group if more than one tab selected

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

  const handleGroupTabs = async () => {
    if (!currentSelectedTabs.length) return;
    await groupTabs(currentSelectedTabs);
    handleSelectionCleared();
  };

  const handleCopyLinks = async () => {
    if (!selectedTabData?.length) return;
    await copyMultipleTabLinks(selectedTabData);
  };

  const handleAddToResourceGroup = () => {
    setCommandMenuOpen(true);
  };

  const handleSelectResourceGroup = async (groupId: number) => {
    if (!selectedTabData?.length) return;
    try {
      await addTabsToResourceGroup(selectedTabData, groupId);
      handleSelectionCleared();
    } catch (error) {
      console.error("Failed to add tabs to resource group:", error);
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

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={handleAddToResourceGroup}
              >
                <Folder className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add to Resource Group</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <CommandMenu
        workspaceId={activeWorkspace?.id ?? null}
        open={commandMenuOpen}
        onOpenChange={setCommandMenuOpen}
        onSelectResourceGroup={handleSelectResourceGroup}
        initialMenuMode="resourceGroups"
      />
    </div>
  );
}
