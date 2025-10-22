"use client";

import {
  ArrowUpDown,
  Bot,
  ChevronDown,
  ChevronUp,
  Group,
  Hash,
  History,
  Monitor,
  PlusCircle,
  RotateCcw,
  Settings2,
  Trash2,
  Ungroup,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { browser } from "wxt/browser";
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { getAIProposedTabsToClean } from "@/lib/ai/ai-cleaning";
import { db } from "@/lib/db/db";
import {
  aiGroupTabs,
  aiGroupTabsCustom,
  cleanDuplicateTabs,
  cleanNonResourceTabs,
  cleanResourceTabs,
  cleanUnusedTabs,
  collapseAllGroups,
  groupTabs,
  sortTabs,
  uncollapseAllGroups,
  ungroupTabs,
} from "@/lib/helpers/tab-operations";
import type { CommandMenuProps, FooterProps } from "../types";

interface MainCommandsProps
  extends Pick<
    CommandMenuProps,
    | "workspaceId"
    | "onOpenSettings"
    | "onOpenCreateWorkspace"
    | "onOpenAICleanReview"
  > {
  searchValue: string;
  setMenuMode: (mode: "main" | "workspaces" | "snapshots") => void;
  onClose: () => void;
  setFooterProps: (props: FooterProps) => void;
}

export function MainCommands({
  workspaceId,
  onOpenSettings,
  onOpenCreateWorkspace,
  onOpenAICleanReview,
  searchValue,
  setMenuMode,
  onClose,
  setFooterProps,
}: MainCommandsProps) {
  const handleSortTabs = (sortType: "title" | "domain" | "recency") => {
    sortTabs(sortType, { workspaceId, onClose });
  };

  const handleGroupTabs = () => {
    groupTabs({ workspaceId, onClose });
  };

  const handleAIGroupTabs = () => {
    aiGroupTabs({ workspaceId, onClose });
  };

  const handleCustomAIGroupTabs = (customInstructions: string) => {
    aiGroupTabsCustom(customInstructions, {
      workspaceId,
      onClose,
    });
  };

  const handleCustomAICleanTabs = async (customInstructions: string) => {
    if (!workspaceId) {
      toast.error("No workspace selected");
      return;
    }

    try {
      toast.loading("Analyzing tabs with AI...", { id: "ai-clean-analysis" });
      const proposedTabIds = await getAIProposedTabsToClean(
        workspaceId,
        customInstructions,
      );
      toast.dismiss("ai-clean-analysis");

      if (proposedTabIds.length === 0) {
        toast.success("No tabs match the cleaning criteria");
        onClose();
        return;
      }

      // Open the review dialog
      onOpenAICleanReview?.(proposedTabIds, customInstructions);
    } catch (error) {
      console.error("Failed to analyze tabs for cleaning:", error);
      toast.error("Failed to analyze tabs for cleaning", {
        id: "ai-clean-analysis",
      });
    }
  };

  const handleUngroupTabs = () => {
    ungroupTabs({ workspaceId, onClose });
  };

  const handleCollapseAllGroups = () => {
    collapseAllGroups({ workspaceId, onClose });
  };

  const handleUncollapseAllGroups = () => {
    uncollapseAllGroups({ workspaceId, onClose });
  };

  const handleCleanUnusedTabs = () => {
    cleanUnusedTabs({ workspaceId, onClose });
  };

  const handleCleanDuplicateTabs = () => {
    cleanDuplicateTabs({ workspaceId, onClose });
  };

  const handleCleanResourceTabs = () => {
    cleanResourceTabs({ workspaceId, onClose });
  };

  const handleCleanNonResourceTabs = () => {
    cleanNonResourceTabs({
      workspaceId,
      onClose,
    });
  };

  const handleCreateSnapshot = async () => {
    if (!workspaceId) {
      toast.error("No active workspace");
      return;
    }
    try {
      const result = await browser.runtime.sendMessage({
        type: "createSnapshot",
        workspaceId,
        reason: "manual",
      });
      if (result?.success) {
        toast.success("Snapshot created successfully");
      } else {
        toast.error(result?.error || "Failed to create snapshot");
      }
    } catch (_error) {
      toast.error("Failed to create snapshot");
    }
    onClose();
  };

  const handleRollbackToPrevious = async () => {
    if (!workspaceId) {
      toast.error("No active workspace");
      return;
    }
    try {
      // Get the most recent snapshot for the current workspace
      const snapshots = await db.workspaceSnapshots
        .where("workspaceId")
        .equals(workspaceId)
        .reverse()
        .sortBy("createdAt");

      if (snapshots.length === 0) {
        toast.error("No snapshots available");
        return;
      }

      const latestSnapshot = snapshots[0];
      const result = await browser.runtime.sendMessage({
        type: "restoreSnapshot",
        snapshotId: latestSnapshot.id,
        mode: "replace",
      });
      if (result?.success) {
        toast.success("Rolled back to previous snapshot");
      } else {
        toast.error(result?.error || "Failed to rollback snapshot");
      }
    } catch (_error) {
      toast.error("Failed to rollback snapshot");
    }
    onClose();
  };

  const handleOpenSettings = () => {
    onOpenSettings?.();
    onClose();
  };

  const handleCreateWorkspace = () => {
    onOpenCreateWorkspace?.();
    onClose();
  };

  const showWorkspaces = () => {
    setMenuMode("workspaces");
    setFooterProps({
      enterText: "Select workspace",
      shortcuts: [
        { key: "⌃H", action: "Back" },
        { key: "⌃←", action: "Back" },
      ],
    });
  };

  const showSnapshots = () => {
    setMenuMode("snapshots");
    setFooterProps({
      enterText: "Select snapshot to restore",
      shortcuts: [
        { key: "⌃H", action: "Back" },
        { key: "⌃←", action: "Back" },
      ],
    });
  };

  // Check if search is a custom group command
  const isCustomGroupCommand = searchValue.toLowerCase().startsWith("group ");
  const customGroupInstructions = isCustomGroupCommand
    ? searchValue.trim()
    : "";

  // Check if search is a custom clean command
  const cleanKeywords = ["clean ", "close ", "remove ", "delete "];
  const isCustomCleanCommand = cleanKeywords.some((keyword) =>
    searchValue.toLowerCase().startsWith(keyword),
  );
  const customCleanInstructions = isCustomCleanCommand
    ? searchValue.trim()
    : "";

  // Update footer props when selection changes
  React.useEffect(() => {
    const commandMap: Record<string, string> = {
      "sort by title a-z": "Sort by Title (A-Z)",
      "sort by domain": "Sort by Domain",
      "sort by recency newest first": "Sort by Recency (Newest First)",
      "group by domain": "Group by Domain",
      "group with tabby ai": "Group with Tabby",
      "ungroup all tabs": "Ungroup All Tabs",
      "collapse all groups": "Collapse All Groups",
      "uncollapse all groups": "Uncollapse All Groups",
      "workspaces browse": "Browse Workspaces",
      "create workspace": "Create Workspace",
      "clean unused tabs 3 days": "Clean Unused Tabs (3+ days)",
      "clean duplicate tabs": "Clean Duplicate Tabs",
      "clean resource tabs": "Clean Resource Tabs",
      "clean non resource tabs": "Clean Non-Resource Tabs",
      settings: "Open Settings",
      "create snapshot": "Create Snapshot",
      "rollback to previous snapshot": "Rollback to Previous Snapshot",
      "view snapshots": "View Snapshots",
    };

    if (customGroupInstructions) {
      setFooterProps({
        enterText: `Group with Tabby (Custom): "${customGroupInstructions}"`,
        shortcuts: [],
      });
    } else if (customCleanInstructions) {
      setFooterProps({
        enterText: `Clean with Tabby (Custom): "${customCleanInstructions}"`,
        shortcuts: [],
      });
    } else {
      setFooterProps({
        enterText: commandMap[searchValue] || "Select command",
        shortcuts: [],
      });
    }
  }, [
    searchValue,
    customGroupInstructions,
    customCleanInstructions,
    setFooterProps,
  ]);

  return (
    <>
      <CommandEmpty>No results found.</CommandEmpty>

      <CommandGroup>
        <CommandItem
          value="sort by title a-z"
          onSelect={() => handleSortTabs("title")}
        >
          <ArrowUpDown className="mr-2 h-4 w-4" />
          <span>Sort by Title (A-Z)</span>
        </CommandItem>
        <CommandItem
          value="sort by domain"
          onSelect={() => handleSortTabs("domain")}
        >
          <Hash className="mr-2 h-4 w-4" />
          <span>Sort by Domain</span>
        </CommandItem>
        <CommandItem
          value="sort by recency newest first"
          onSelect={() => handleSortTabs("recency")}
        >
          <ArrowUpDown className="mr-2 h-4 w-4" />
          <span>Sort by Recency (Newest First)</span>
        </CommandItem>
        <CommandItem value="group by domain" onSelect={handleGroupTabs}>
          <Group className="mr-2 h-4 w-4" />
          <span>Group by Domain</span>
        </CommandItem>
        <CommandItem value="group with tabby ai" onSelect={handleAIGroupTabs}>
          <Bot className="mr-2 h-4 w-4" />
          <span>Group with Tabby</span>
        </CommandItem>
        {isCustomGroupCommand && customGroupInstructions && (
          <CommandItem
            value={`group ${customGroupInstructions}`}
            onSelect={() => handleCustomAIGroupTabs(customGroupInstructions)}
          >
            <Bot className="mr-2 h-4 w-4" />
            <span>Group: "{customGroupInstructions}"</span>
          </CommandItem>
        )}
        {isCustomCleanCommand && customCleanInstructions && (
          <CommandItem
            value={`clean ${customCleanInstructions}`}
            onSelect={() => handleCustomAICleanTabs(customCleanInstructions)}
          >
            <Bot className="mr-2 h-4 w-4" />
            <span>Clean: "{customCleanInstructions}"</span>
          </CommandItem>
        )}
        <CommandItem value="ungroup all tabs" onSelect={handleUngroupTabs}>
          <Ungroup className="mr-2 h-4 w-4" />
          <span>Ungroup All Tabs</span>
        </CommandItem>
        <CommandItem
          value="collapse all groups"
          onSelect={handleCollapseAllGroups}
        >
          <ChevronDown className="mr-2 h-4 w-4" />
          <span>Collapse All Groups</span>
        </CommandItem>
        <CommandItem
          value="uncollapse all groups"
          onSelect={handleUncollapseAllGroups}
        >
          <ChevronUp className="mr-2 h-4 w-4" />
          <span>Uncollapse All Groups</span>
        </CommandItem>
        <CommandItem value="workspaces browse" onSelect={showWorkspaces}>
          <Monitor className="mr-2 h-4 w-4" />
          <span>Workspaces</span>
        </CommandItem>
        <CommandItem
          value="create workspace"
          keywords={["new workspace"]}
          onSelect={handleCreateWorkspace}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          <span>Create Workspace</span>
        </CommandItem>
        <CommandItem
          value="clean unused tabs 3 days"
          keywords={["remove unused tabs 3 days"]}
          onSelect={handleCleanUnusedTabs}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Clean Unused Tabs (3+ days)</span>
        </CommandItem>
        <CommandItem
          value="clean duplicate tabs"
          keywords={["remove duplicate tabs"]}
          onSelect={handleCleanDuplicateTabs}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Clean Duplicate Tabs</span>
        </CommandItem>
        <CommandItem
          value="clean resource tabs"
          keywords={["remove resource tabs"]}
          onSelect={handleCleanResourceTabs}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Clean Resource Tabs</span>
        </CommandItem>
        <CommandItem
          value="clean non resource tabs"
          keywords={["remove non resource tabs"]}
          onSelect={handleCleanNonResourceTabs}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Clean Non-Resource Tabs</span>
        </CommandItem>
        <CommandItem value="settings" onSelect={handleOpenSettings}>
          <Settings2 className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </CommandItem>
        <CommandItem
          value="create snapshot"
          keywords={["take snapshot", "snapshot create"]}
          onSelect={handleCreateSnapshot}
        >
          <History className="mr-2 h-4 w-4" />
          <span>Create Snapshot</span>
        </CommandItem>
        <CommandItem
          value="rollback to previous snapshot"
          keywords={["restore snapshot", "snapshot rollback"]}
          onSelect={handleRollbackToPrevious}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          <span>Rollback to Previous Snapshot</span>
        </CommandItem>
        <CommandItem
          value="view snapshots"
          keywords={["snapshot history", "snapshot viewer"]}
          onSelect={showSnapshots}
        >
          <History className="mr-2 h-4 w-4" />
          <span>View Snapshots</span>
        </CommandItem>
      </CommandGroup>
    </>
  );
}
