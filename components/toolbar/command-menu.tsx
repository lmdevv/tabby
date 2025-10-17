"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  ArrowUpDown,
  Bot,
  Group,
  Hash,
  Monitor,
} from "lucide-react";
import { useCallback, useState } from "react";
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

  const isControlled = externalOpen !== undefined && onOpenChange !== undefined;
  const open = isControlled ? externalOpen : internalOpen;

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
      }
    },
    [isControlled, onOpenChange],
  );

  // Fetch all workspaces
  const workspaces = useLiveQuery(() => db.workspaces.toArray(), []);

  // Fetch all workspace groups
  const workspaceGroups = useLiveQuery(() => db.workspaceGroups.toArray(), []);

  // Get active workspace
  const activeWorkspace = useLiveQuery(
    () => db.workspaces.where("active").equals(1).first(),
    [],
  );

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

  const goBackToMain = () => {
    setMenuMode("main");
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
            <CommandItem onSelect={showWorkspaces}>
              <Monitor className="mr-2 h-4 w-4" />
              <span>Workspaces</span>
            </CommandItem>
          </CommandGroup>
        )}

        {menuMode === "workspaces" && (
          <CommandGroup>
            <CommandItem onSelect={goBackToMain}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span>Back to Commands</span>
            </CommandItem>
            {workspaces?.map((workspace) =>
              workspace.id ? (
                <CommandItem
                  key={workspace.id}
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
    </CommandDialog>
  );
}
