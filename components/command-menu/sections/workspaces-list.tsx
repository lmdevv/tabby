"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Monitor } from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { db } from "@/lib/db/db";
import { openWorkspace } from "@/lib/helpers/tab-operations";
import { WorkspaceBreadcrumb } from "../presentation/workspace-breadcrumb";
import type { FooterProps } from "../types";

interface WorkspacesListProps {
  selectedValue: string;
  onClose: () => void;
  setFooterProps: (props: FooterProps) => void;
}

export function WorkspacesList({
  selectedValue,
  onClose,
  setFooterProps,
}: WorkspacesListProps) {
  // Fetch all workspaces
  const workspaces = useLiveQuery(() => db.workspaces.toArray(), []);

  // Fetch all workspace groups
  const workspaceGroups = useLiveQuery(() => db.workspaceGroups.toArray(), []);

  // Get active workspace
  const activeWorkspace = useLiveQuery(
    () => db.workspaces.where("active").equals(1).first(),
    [],
  );

  const handleOpenWorkspace = (workspaceIdToOpen: number) => {
    openWorkspace(workspaceIdToOpen, onClose);
  };

  // Update footer when selection changes
  React.useEffect(() => {
    const selectedWorkspace = workspaces?.find(
      (w) => w.id?.toString() === selectedValue,
    );
    if (selectedWorkspace) {
      setFooterProps({
        enterText: `Open "${selectedWorkspace.name}"`,
        shortcuts: [
          { key: "⌃H", action: "Back" },
          { key: "⌃←", action: "Back" },
        ],
      });
    } else {
      setFooterProps({
        enterText: "Select workspace",
        shortcuts: [
          { key: "⌃H", action: "Back" },
          { key: "⌃←", action: "Back" },
        ],
      });
    }
  }, [selectedValue, workspaces, setFooterProps]);

  return (
    <>
      <CommandEmpty>No results found.</CommandEmpty>

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
                <WorkspaceBreadcrumb
                  workspace={workspace}
                  workspaceGroups={workspaceGroups}
                />
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
    </>
  );
}
