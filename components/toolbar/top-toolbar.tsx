"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowUpDown, CheckSquare, History, RefreshCw } from "lucide-react";
import { useState } from "react";
import { HistoryDialog } from "@/components/snapshots/history-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppState, useUpdateState } from "@/hooks/use-state";
import { db } from "@/lib/db/db";
import {
  aiGroupTabs,
  cleanAllTabs,
  cleanDuplicateTabs,
  cleanNonResourceTabs,
  cleanResourceTabs,
  cleanUnusedTabs,
  groupTabs,
  refreshTabs,
  sortTabs,
  ungroupTabs,
} from "@/lib/helpers/tab-operations";

interface TopToolbarProps {
  workspaceId: number | null;
  // When previewing a workspace that is not active, we also want to read archived tabs
  isPreview?: boolean;
}

export function TopToolbar({
  workspaceId,
  isPreview = false,
}: TopToolbarProps) {
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // Get UI state directly from global state
  const { data: selectedTabsData } = useAppState("selectedTabs");
  const { updateState } = useUpdateState();

  const selectedTabs = (selectedTabsData as number[]) ?? [];

  const handleSelectTabs = (tabIds: number[]) => {
    updateState("selectedTabs", tabIds);
  };

  // Get tabs data directly from DB
  const tabs = useLiveQuery(() => {
    if (!workspaceId) return [];
    const base = db.activeTabs.where("workspaceId").equals(workspaceId);
    // In preview mode, include archived tabs so we can view the workspace contents
    return isPreview
      ? base.toArray()
      : base.and((tab) => tab.tabStatus === "active").toArray();
  }, [workspaceId, isPreview]);

  const tabsCount = tabs?.length || 0;
  const selectedTabsCount = selectedTabs.length;

  const handleSelectAll = () => {
    if (!tabs?.length) return;
    const allTabIds = tabs
      .map((tab) => tab.id)
      .filter((id): id is number => id !== undefined);
    handleSelectTabs(selectedTabs.length === allTabIds.length ? [] : allTabIds);
  };

  const handleRefresh = async (): Promise<void> => {
    await refreshTabs({ workspaceId });
  };

  const handleHistory = () => {
    setHistoryDialogOpen(true);
  };

  const handleSortTabs = (sortType: "title" | "domain" | "recency") => {
    sortTabs(sortType, { workspaceId });
  };

  const handleGroupTabs = () => {
    groupTabs({ workspaceId });
  };

  const handleAIGroupTabs = () => {
    aiGroupTabs({ workspaceId });
  };

  const handleUngroupTabs = () => {
    ungroupTabs({ workspaceId });
  };

  const handleCleanUnusedTabs = () => {
    cleanUnusedTabs({ workspaceId });
  };

  const handleCleanDuplicateTabs = () => {
    cleanDuplicateTabs({ workspaceId });
  };

  const handleCleanResourceTabs = () => {
    cleanResourceTabs({ workspaceId });
  };

  const handleCleanNonResourceTabs = () => {
    cleanNonResourceTabs({ workspaceId });
  };

  const handleCleanAllTabs = () => {
    cleanAllTabs({ workspaceId });
  };
  return (
    <div className="flex gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleSelectAll}>
              <CheckSquare className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {selectedTabsCount === tabsCount ? "Deselect All" : "Select All"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleHistory}>
              <History className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>View tab history</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Refresh tabs</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenu>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Sort tabs</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleSortTabs("title")}>
            Sort by Title (A-Z)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSortTabs("domain")}>
            Sort by Domain
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSortTabs("recency")}>
            Sort by Recency (Newest First)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleAIGroupTabs}>
            Group Tabs
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleGroupTabs}>
            Group Tabs by Domain
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleUngroupTabs}>
            Ungroup All Tabs
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCleanUnusedTabs}>
            Clean Unused Tabs (3+ days)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCleanDuplicateTabs}>
            Clean Duplicate Tabs
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCleanResourceTabs}>
            Clean Resource Tabs
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCleanNonResourceTabs}>
            Clean Non-Resource Tabs
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCleanAllTabs}>
            Clean All Tabs
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* History Dialog */}
      <HistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        workspaceId={workspaceId || -1}
      />
    </div>
  );
}
