"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import type { Browser } from "wxt/browser";
import { useTheme } from "@/components/theme-provider";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const isDarkFromTheme = (theme: "light" | "dark" | "system"): boolean => {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
};

import { browserColorToHex, withAlpha } from "@/lib/tab-group-colors";

type TabGroup = Browser.tabGroups.TabGroup;

interface TabGroupHeaderProps {
  groupInfo: TabGroup;
  tabCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onEditGroup: () => void;
  onUngroupAll: () => void;
  onCloseAll: () => void;
}

export function TabGroupHeader({
  groupInfo,
  tabCount,
  collapsed,
  onToggleCollapse,
  onEditGroup,
  onUngroupAll,
  onCloseAll,
}: TabGroupHeaderProps) {
  const { theme } = useTheme();
  const accentHex =
    (groupInfo.color?.toString?.().startsWith("#")
      ? (groupInfo.color as string)
      : browserColorToHex(groupInfo.color as Browser.tabGroups.ColorEnum)) ||
    "#6b7280"; // fallback grey
  const headerBg = withAlpha(accentHex, isDarkFromTheme(theme) ? 0.2 : 0.1);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border-transparent p-2 transition-all duration-200 hover:border-accent hover:bg-accent/50"
          onClick={onToggleCollapse}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggleCollapse();
            }
          }}
          aria-label={`${collapsed ? "Expand" : "Collapse"} group ${groupInfo.title || "Untitled"}`}
          style={{ backgroundColor: headerBg }}
        >
          <div className="flex items-center gap-2">
            {collapsed ? (
              <ChevronRight className="h-4 w-4" style={{ color: accentHex }} />
            ) : (
              <ChevronDown className="h-4 w-4" style={{ color: accentHex }} />
            )}
            <span className="font-medium text-sm">
              {groupInfo.title || "Untitled"}
            </span>
          </div>
          <span className="text-muted-foreground text-xs">
            {tabCount} {tabCount === 1 ? "tab" : "tabs"}
          </span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onEditGroup}>Edit Group</ContextMenuItem>
        <ContextMenuItem onClick={onUngroupAll}>
          Ungroup All Tabs
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onCloseAll} className="text-destructive">
          Close All Tabs
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
