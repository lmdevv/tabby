"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Folder } from "lucide-react";
import React from "react";
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { db } from "@/lib/db/db";
import type { FooterProps } from "../types";

interface ResourceGroupsListProps {
  selectedValue: string;
  onSelectResourceGroup: (groupId: number) => void;
  onMoveToResourceGroup?: (groupId: number) => void;
  onClose: () => void;
  setFooterProps: (props: FooterProps) => void;
}

export function ResourceGroupsList({
  selectedValue,
  onSelectResourceGroup,
  onMoveToResourceGroup,
  onClose,
  setFooterProps,
}: ResourceGroupsListProps) {
  // Fetch all resource groups sorted by name
  const resourceGroups = useLiveQuery(
    () => db.resourceGroups.orderBy("name").toArray(),
    [],
  );

  const handleSelectResourceGroup = React.useCallback(
    (groupId: number) => {
      onSelectResourceGroup(groupId);
      onClose();
    },
    [onSelectResourceGroup, onClose],
  );

  // Update footer when selection changes
  React.useEffect(() => {
    const selectedGroup = resourceGroups?.find(
      (g) => g.id?.toString() === selectedValue,
    );
    if (selectedGroup) {
      setFooterProps({
        enterText: `Add to "${selectedGroup.name}"`,
        shortcuts: [{ key: "⌃Enter", action: "Move" }],
      });
    } else {
      setFooterProps({
        enterText: "Select resource group",
        shortcuts: [],
      });
    }
  }, [selectedValue, resourceGroups, setFooterProps]);

  return (
    <>
      {/* Avoid flashing "No results" while queries are initializing */}
      {resourceGroups !== undefined && (
        <CommandEmpty>No results found.</CommandEmpty>
      )}

      <CommandGroup>
        {resourceGroups?.map((group) =>
          group.id ? (
            <CommandItem
              key={group.id}
              value={group.id?.toString()}
              onSelect={() => handleSelectResourceGroup(group.id)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  (e.ctrlKey || e.metaKey) &&
                  onMoveToResourceGroup
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  onMoveToResourceGroup(group.id);
                  onClose();
                }
              }}
            >
              <Folder className="mr-2 h-4 w-4" />
              <span className="flex-1">{group.name}</span>
              {group.description && (
                <span className="text-muted-foreground text-sm ml-2">
                  {group.description}
                </span>
              )}
            </CommandItem>
          ) : null,
        )}
      </CommandGroup>
    </>
  );
}
