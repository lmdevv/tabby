"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowUpDown, Bot, Group, Hash, Monitor } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { browser } from "wxt/browser";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { aiGroupTabsInWorkspace } from "@/lib/ai/ai-grouping";
import { db } from "@/lib/db/db";

interface CommandMenuProps {
  workspaceId: number | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type MenuMode = "main" | "workspaces";

export function CommandMenu({
  workspaceId,
  open: externalOpen,
  onOpenChange,
}: CommandMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<MenuMode>("main");
  const [searchValue, setSearchValue] = useState("");
  const [selectedValue, setSelectedValue] = useState<string>("");

  const isControlled = externalOpen !== undefined && onOpenChange !== undefined;
  const open = isControlled ? externalOpen : internalOpen;

  const goBackToMain = useCallback(() => {
    setMenuMode("main");
    setSelectedValue("");
    setSearchValue("");
  }, []);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (isControlled && onOpenChange) {
        onOpenChange(newOpen);
      } else {
        setInternalOpen(newOpen);
      }
      // Reset to main menu and clear search when closing
      if (!newOpen) {
        setMenuMode("main");
        setSearchValue("");
        setSelectedValue("");
      }
    },
    [isControlled, onOpenChange],
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return;

      // Ctrl+H or Ctrl+Left Arrow to go back in workspaces mode
      if (menuMode === "workspaces") {
        if (
          (event.ctrlKey && event.key === "h") ||
          (event.ctrlKey && event.key === "ArrowLeft")
        ) {
          event.preventDefault();
          goBackToMain();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, menuMode, goBackToMain]);

  // Fetch all workspaces
  const workspaces = useLiveQuery(() => db.workspaces.toArray(), []);

  // Fetch all workspace groups
  const workspaceGroups = useLiveQuery(() => db.workspaceGroups.toArray(), []);

  // Get active workspace
  const activeWorkspace = useLiveQuery(
    () => db.workspaces.where("active").equals(1).first(),
    [],
  );

  // TODO: This helpers might have to be moved to separate file and imported when needed
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

  const openWorkspace = async (workspaceIdToOpen: number) => {
    try {
      await browser.runtime.sendMessage({
        type: "openWorkspace",
        workspaceId: workspaceIdToOpen,
      });
      toast.success("Workspace opened successfully");
      handleOpenChange(false);
    } catch (error) {
      console.error("Failed to open workspace:", error);
      toast.error("Failed to open workspace");
    }
  };

  const showWorkspaces = () => {
    setMenuMode("workspaces");
    setSearchValue("");
  };

  // Get footer content based on current mode and selection
  const getFooterContent = () => {
    if (menuMode === "workspaces") {
      const selectedWorkspace = workspaces?.find(
        (w) => w.id?.toString() === selectedValue,
      );
      if (selectedWorkspace) {
        return {
          enterText: `Open "${selectedWorkspace.name}"`,
          shortcuts: [
            { key: "⌃H", action: "Back" },
            { key: "⌃←", action: "Back" },
          ],
        };
      }
      return {
        enterText: "Select workspace",
        shortcuts: [
          { key: "⌃H", action: "Back" },
          { key: "⌃←", action: "Back" },
        ],
      };
    }

    // Main menu mode
    const commandMap: Record<string, string> = {
      "sort-title": "Sort by Title (A-Z)",
      "sort-domain": "Sort by Domain",
      "sort-recency": "Sort by Recency (Newest First)",
      "group-domain": "Group by Domain",
      "group-ai": "Group with Tabby",
      workspaces: "Browse Workspaces",
    };

    const action = commandMap[selectedValue];
    return {
      enterText: action || "Select command",
      shortcuts: [],
    };
  };

  // Helper function to get workspace display element with group breadcrumbs
  const getWorkspaceDisplayElement = (workspace: {
    id: number;
    name: string;
    groupId?: number;
  }) => {
    if (workspace.groupId && workspaceGroups) {
      const group = workspaceGroups.find((g) => g.id === workspace.groupId);
      if (group) {
        return (
          <Breadcrumb>
            <BreadcrumbList className="gap-1">
              <BreadcrumbItem>
                <BreadcrumbLink className="text-muted-foreground hover:text-muted-foreground">
                  {group.name}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-foreground">
                  {workspace.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        );
      }
    }
    return <span>{workspace.name}</span>;
  };

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <Command
        value={selectedValue}
        onValueChange={setSelectedValue}
        className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
      >
        <CommandInput
          placeholder={
            menuMode === "workspaces"
              ? "Search workspaces..."
              : "Type a command..."
          }
          value={searchValue}
          onValueChange={setSearchValue}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {menuMode === "main" && (
            <CommandGroup>
              <CommandItem
                value="sort-title"
                onSelect={() => handleSortTabs("title")}
              >
                <ArrowUpDown className="mr-2 h-4 w-4" />
                <span>Sort by Title (A-Z)</span>
              </CommandItem>
              <CommandItem
                value="sort-domain"
                onSelect={() => handleSortTabs("domain")}
              >
                <Hash className="mr-2 h-4 w-4" />
                <span>Sort by Domain</span>
              </CommandItem>
              <CommandItem
                value="sort-recency"
                onSelect={() => handleSortTabs("recency")}
              >
                <ArrowUpDown className="mr-2 h-4 w-4" />
                <span>Sort by Recency (Newest First)</span>
              </CommandItem>
              <CommandItem value="group-domain" onSelect={handleGroupTabs}>
                <Group className="mr-2 h-4 w-4" />
                <span>Group by Domain</span>
              </CommandItem>
              <CommandItem value="group-ai" onSelect={handleAIGroupTabs}>
                <Bot className="mr-2 h-4 w-4" />
                <span>Group with Tabby</span>
              </CommandItem>
              <CommandItem value="workspaces" onSelect={showWorkspaces}>
                <Monitor className="mr-2 h-4 w-4" />
                <span>Workspaces</span>
              </CommandItem>
            </CommandGroup>
          )}

          {menuMode === "workspaces" && (
            <CommandGroup>
              {workspaces?.map((workspace) =>
                workspace.id ? (
                  <CommandItem
                    key={workspace.id}
                    value={`${workspace.name} ${workspace.groupId ? workspaceGroups?.find((g) => g.id === workspace.groupId)?.name : ""}`}
                    onSelect={() => openWorkspace(workspace.id)}
                  >
                    <Monitor className="mr-2 h-4 w-4" />
                    <span className="flex-1">
                      {getWorkspaceDisplayElement(workspace)}
                    </span>
                    {activeWorkspace?.id === workspace.id && (
                      <Badge variant="secondary" className="ml-2">
                        Active
                      </Badge>
                    )}
                  </CommandItem>
                ) : null,
              )}
            </CommandGroup>
          )}
        </CommandList>

        {/* Footer */}
        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span>↵</span>
              <span>{getFooterContent().enterText}</span>
            </div>
            <div className="flex items-center gap-3">
              {getFooterContent().shortcuts.map((shortcut) => (
                <div key={shortcut.key} className="flex items-center gap-1">
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                    <span className="text-xs">{shortcut.key}</span>
                  </kbd>
                  <span>{shortcut.action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Command>
    </CommandDialog>
  );
}
