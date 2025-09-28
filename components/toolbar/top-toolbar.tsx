"use client";

import {
  ArrowUpDown,
  CheckSquare,
  History,
  Link2,
  RefreshCw,
  Tag,
} from "lucide-react";
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

interface TopToolbarProps {
  showTags: boolean;
  showUrls: boolean;
  selectedTabsCount: number;
  tabsCount: number;
  onToggleShowTags: () => void;
  onToggleShowUrls: () => void;
  onSelectAll: () => void;
  onRefresh: () => void;
  onHistory: () => void;
  onSortTabs: (sortType: "title" | "domain" | "recency") => void;
  onGroupTabs: (groupType: "domain") => void;
}

export function TopToolbar({
  showTags,
  showUrls,
  selectedTabsCount,
  tabsCount,
  onToggleShowTags,
  onToggleShowUrls,
  onSelectAll,
  onRefresh,
  onHistory,
  onSortTabs,
  onGroupTabs,
}: TopToolbarProps) {
  return (
    <div className="flex gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showTags ? "default" : "ghost"}
              size="icon"
              onClick={onToggleShowTags}
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
              onClick={onToggleShowUrls}
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
            <Button variant="ghost" size="icon" onClick={onSelectAll}>
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
            <Button variant="ghost" size="icon" onClick={onHistory}>
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
            <Button variant="ghost" size="icon" onClick={onRefresh}>
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
          <DropdownMenuItem onClick={() => onSortTabs("title")}>
            Sort by Title (A-Z)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortTabs("domain")}>
            Sort by Domain
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortTabs("recency")}>
            Sort by Recency (Newest First)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onGroupTabs("domain")}>
            Group by Domain
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
