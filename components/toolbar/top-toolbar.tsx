"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowUpDown,
  CheckSquare,
  History,
  Link2,
  RefreshCw,
  Tag,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { browser } from "wxt/browser";
import { HistoryDialog } from "@/components/snapshots/history-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppState, useUpdateState } from "@/hooks/use-state";
import { db } from "@/lib/db";

interface TopToolbarProps {
  workspaceId: number | null;
  windowId: number;
  selectedTabs: number[];
  onSelectTabs: (tabIds: number[]) => void;
}

export function TopToolbar({
  workspaceId,
  windowId,
  selectedTabs,
  onSelectTabs,
}: TopToolbarProps) {
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // Get UI state directly from global state
  const { data: showTagsData } = useAppState("showTags");
  const { data: showUrlsData } = useAppState("showUrls");
  const { updateState } = useUpdateState();

  const showTags = (showTagsData ?? true) as boolean;
  const showUrls = (showUrlsData ?? true) as boolean;

  // Get tabs data directly from DB
  const tabs = useLiveQuery(() => {
    if (!workspaceId) return [];
    return db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .filter((tab) => tab.windowId === windowId)
      .toArray();
  }, [workspaceId, windowId]);

  const tabsCount = tabs?.length || 0;
  const selectedTabsCount = selectedTabs.length;

  const toggleShowTags = () => updateState("showTags", !showTags);
  const toggleShowUrls = () => updateState("showUrls", !showUrls);

  const handleSelectAll = () => {
    if (!tabs?.length) return;
    const allTabIds = tabs
      .map((tab) => tab.id)
      .filter((id): id is number => id !== undefined);
    onSelectTabs(selectedTabs.length === allTabIds.length ? [] : allTabIds);
  };

  const handleRefresh = async (): Promise<void> => {
    try {
      await browser.runtime.sendMessage({ type: "refreshTabs" });
      toast.success("Tabs refreshed successfully");
    } catch (error) {
      console.error("Failed to refresh tabs:", error);
      toast.error("Failed to refresh tabs");
    }
  };

  const handleHistory = () => {
    setHistoryDialogOpen(true);
  };

  const handleSortTabs = async (sortType: "title" | "domain" | "recency") => {
    try {
      await browser.runtime.sendMessage({
        type: "sortTabs",
        windowId,
        sortType,
      } as const);
      toast.success("Tabs sorted successfully");
    } catch (error) {
      console.error("Failed to sort tabs:", error);
      toast.error("Failed to sort tabs");
    }
  };

  const handleGroupTabs = async () => {
    try {
      await browser.runtime.sendMessage({
        type: "groupTabs",
        windowId,
        groupType: "domain",
      } as const);
      toast.success("Tabs grouped successfully");
    } catch (error) {
      console.error("Failed to group tabs:", error);
      toast.error("Failed to group tabs");
    }
  };
  return (
    <div className="flex gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showTags ? "default" : "ghost"}
              size="icon"
              onClick={toggleShowTags}
            >
              <Tag className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {showTags ? "Hide Tags" : "Show Tags"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showUrls ? "default" : "ghost"}
              size="icon"
              onClick={toggleShowUrls}
            >
              <Link2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {showUrls ? "Hide URLs" : "Show URLs"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

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
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleGroupTabs}>
            Group by Domain
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
