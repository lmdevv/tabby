"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowUpDown,
  Bot,
  Group,
  Hash,
  Monitor,
  PlusCircle,
  Settings2,
  Trash2,
  Ungroup,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { Kbd } from "@/components/ui/kbd";
import { db } from "@/lib/db/db";
import {
  aiGroupTabs,
  aiGroupTabsCustom,
  cleanDuplicateTabs,
  cleanNonResourceTabs,
  cleanResourceTabs,
  cleanUnusedTabs,
  groupTabs,
  openWorkspace,
  sortTabs,
  ungroupTabs,
} from "@/lib/helpers/tab-operations";

interface CommandMenuProps {
  workspaceId: number | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenSettings?: () => void;
  onOpenCreateWorkspace?: () => void;
}

type MenuMode = "main" | "workspaces";

export function CommandMenu({
  workspaceId,
  open: externalOpen,
  onOpenChange,
  onOpenSettings,
  onOpenCreateWorkspace,
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

  const handleSortTabs = (sortType: "title" | "domain" | "recency") => {
    sortTabs(sortType, { workspaceId, onClose: () => handleOpenChange(false) });
  };

  const handleGroupTabs = () => {
    groupTabs({ workspaceId, onClose: () => handleOpenChange(false) });
  };

  const handleAIGroupTabs = () => {
    aiGroupTabs({ workspaceId, onClose: () => handleOpenChange(false) });
  };

  const handleCustomAIGroupTabs = (customInstructions: string) => {
    aiGroupTabsCustom(customInstructions, {
      workspaceId,
      onClose: () => handleOpenChange(false),
    });
  };

  const handleUngroupTabs = () => {
    ungroupTabs({ workspaceId, onClose: () => handleOpenChange(false) });
  };

  const handleOpenWorkspace = (workspaceIdToOpen: number) => {
    openWorkspace(workspaceIdToOpen, () => handleOpenChange(false));
  };

  const handleCleanUnusedTabs = () => {
    cleanUnusedTabs({ workspaceId, onClose: () => handleOpenChange(false) });
  };

  const handleCleanDuplicateTabs = () => {
    cleanDuplicateTabs({ workspaceId, onClose: () => handleOpenChange(false) });
  };

  const handleCleanResourceTabs = () => {
    cleanResourceTabs({ workspaceId, onClose: () => handleOpenChange(false) });
  };

  const handleCleanNonResourceTabs = () => {
    cleanNonResourceTabs({
      workspaceId,
      onClose: () => handleOpenChange(false),
    });
  };

  const handleOpenSettings = () => {
    onOpenSettings?.();
    handleOpenChange(false);
  };

  const handleCreateWorkspace = () => {
    onOpenCreateWorkspace?.();
    handleOpenChange(false);
  };

  const showWorkspaces = () => {
    setMenuMode("workspaces");
    setSearchValue("");
  };

  // Check if search is a custom group command
  const isCustomGroupCommand = searchValue.toLowerCase().startsWith("group ");
  const customGroupInstructions = isCustomGroupCommand
    ? searchValue.trim()
    : "";

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
      "sort by title a-z": "Sort by Title (A-Z)",
      "sort by domain": "Sort by Domain",
      "sort by recency newest first": "Sort by Recency (Newest First)",
      "group by domain": "Group by Domain",
      "group with tabby ai": "Group with Tabby",
      "ungroup all tabs": "Ungroup All Tabs",
      "workspaces browse": "Browse Workspaces",
      "create workspace": "Create Workspace",
      "clean unused tabs 3 days": "Clean Unused Tabs (3+ days)",
      "clean duplicate tabs": "Clean Duplicate Tabs",
      "clean resource tabs": "Clean Resource Tabs",
      "clean non resource tabs": "Clean Non-Resource Tabs",
      "settings": "Open Settings",
    };

    if (isCustomGroupCommand && customGroupInstructions) {
      return {
        enterText: `Group with Tabby (Custom): "${customGroupInstructions}"`,
        shortcuts: [],
      };
    }

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
      <Command value={selectedValue} onValueChange={setSelectedValue}>
        <CommandInput
          placeholder={
            menuMode === "workspaces"
              ? "Search workspaces..."
              : "Type a command..."
          }
          value={searchValue}
          onValueChange={setSearchValue}
        />
        <CommandList className="scrollbar-none">
          <CommandEmpty>No results found.</CommandEmpty>

          {menuMode === "main" && (
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
              <CommandItem
                value="group with tabby ai"
                onSelect={handleAIGroupTabs}
              >
                <Bot className="mr-2 h-4 w-4" />
                <span>Group with Tabby</span>
              </CommandItem>
              {isCustomGroupCommand && customGroupInstructions && (
                <CommandItem
                  value={`group ${customGroupInstructions}`}
                  onSelect={() =>
                    handleCustomAIGroupTabs(customGroupInstructions)
                  }
                >
                  <Bot className="mr-2 h-4 w-4" />
                  <span>Group: "{customGroupInstructions}"</span>
                </CommandItem>
              )}
              <CommandItem
                value="ungroup all tabs"
                onSelect={handleUngroupTabs}
              >
                <Ungroup className="mr-2 h-4 w-4" />
                <span>Ungroup All Tabs</span>
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
            </CommandGroup>
          )}

          {menuMode === "workspaces" && (
            <CommandGroup>
              {workspaces?.map((workspace) =>
                workspace.id ? (
                  <CommandItem
                    key={workspace.id}
                    value={`${workspace.name} ${workspace.groupId ? workspaceGroups?.find((g) => g.id === workspace.groupId)?.name : ""}`}
                    onSelect={() => handleOpenWorkspace(workspace.id)}
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
              <Kbd>↵</Kbd>
              <span>{getFooterContent().enterText}</span>
            </div>
            <div className="flex items-center gap-3">
              {getFooterContent().shortcuts.map((shortcut) => (
                <div key={shortcut.key} className="flex items-center gap-1">
                  <Kbd>{shortcut.key}</Kbd>
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
