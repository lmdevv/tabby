"use client";

import { ArrowUpDown, Bot, Group, Hash } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { browser } from "wxt/browser";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { aiGroupTabsInWorkspace } from "@/lib/ai/ai-grouping";

interface CommandMenuProps {
  workspaceId: number | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandMenu({
  workspaceId,
  open: externalOpen,
  onOpenChange,
}: CommandMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = externalOpen !== undefined && onOpenChange !== undefined;
  const open = isControlled ? externalOpen : internalOpen;

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (isControlled && onOpenChange) {
        onOpenChange(newOpen);
      } else {
        setInternalOpen(newOpen);
      }
    },
    [isControlled, onOpenChange],
  );

  useEffect(() => {
    if (isControlled) return; // Skip keyboard listener if controlled externally

    const down = (e: KeyboardEvent) => {
      if (e.key === "o") {
        e.preventDefault();
        handleOpenChange(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isControlled, open, handleOpenChange]);

  const handleSortTabs = async (sortType: "title" | "domain" | "recency") => {
    try {
      await browser.runtime.sendMessage({
        type: "sortTabs",
        workspaceId,
        sortType,
      } as const);
      toast.success("Tabs sorted successfully");
      handleOpenChange(false);
    } catch (error) {
      console.error("Failed to sort tabs:", error);
      toast.error("Failed to sort tabs");
    }
  };

  const handleGroupTabs = async () => {
    try {
      await browser.runtime.sendMessage({
        type: "groupTabs",
        workspaceId,
        groupType: "domain",
      } as const);
      toast.success("Tabs grouped successfully");
      handleOpenChange(false);
    } catch (error) {
      console.error("Failed to group tabs:", error);
      toast.error("Failed to group tabs");
    }
  };

  const handleAIGroupTabs = async () => {
    if (!workspaceId) {
      toast.error("No workspace selected");
      return;
    }

    try {
      toast.loading("Grouping tabs with AI...", { id: "ai-grouping" });
      await aiGroupTabsInWorkspace(workspaceId);
      toast.success("Tabs grouped with AI successfully", { id: "ai-grouping" });
      handleOpenChange(false);
    } catch (error) {
      console.error("Failed to AI group tabs:", error);
      toast.error("Failed to AI group tabs", { id: "ai-grouping" });
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput placeholder="Type a command..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup>
          <CommandItem onSelect={() => handleSortTabs("title")}>
            <ArrowUpDown className="mr-2 h-4 w-4" />
            <span>Sort by Title (A-Z)</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSortTabs("domain")}>
            <Hash className="mr-2 h-4 w-4" />
            <span>Sort by Domain</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSortTabs("recency")}>
            <ArrowUpDown className="mr-2 h-4 w-4" />
            <span>Sort by Recency (Newest First)</span>
          </CommandItem>
          <CommandItem onSelect={handleGroupTabs}>
            <Group className="mr-2 h-4 w-4" />
            <span>Group by Domain</span>
          </CommandItem>
          <CommandItem onSelect={handleAIGroupTabs}>
            <Bot className="mr-2 h-4 w-4" />
            <span>Group with Tabby</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
