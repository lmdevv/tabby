"use client";

import { CheckSquare, Link2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FilterDropdown } from "./filter-dropdown";

type FilterType =
  | "all"
  | "pinned"
  | "audible"
  | "muted"
  | "highlighted"
  | "discarded";

interface TopToolbarProps {
  showTags: boolean;
  showUrls: boolean;
  selectedTabsCount: number;
  filteredTabsCount: number;
  activeFilter: FilterType;
  selectedTags: string[];
  allTags: string[];
  onToggleShowTags: () => void;
  onToggleShowUrls: () => void;
  onSelectAll: () => void;
  onFilterChange: (filter: FilterType) => void;
  onToggleTag: (tag: string) => void;
}

export function TopToolbar({
  showTags,
  showUrls,
  selectedTabsCount,
  filteredTabsCount,
  activeFilter,
  selectedTags,
  allTags,
  onToggleShowTags,
  onToggleShowUrls,
  onSelectAll,
  onFilterChange,
  onToggleTag,
}: TopToolbarProps) {
  return (
    <div className="flex gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showTags ? "default" : "outline"}
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
              variant={showUrls ? "default" : "outline"}
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
            <Button variant="outline" size="icon" onClick={onSelectAll}>
              <CheckSquare className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {selectedTabsCount === filteredTabsCount
              ? "Deselect All"
              : "Select All"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <FilterDropdown
        activeFilter={activeFilter}
        selectedTags={selectedTags}
        allTags={allTags}
        onFilterChange={onFilterChange}
        onToggleTag={onToggleTag}
      />
    </div>
  );
}
