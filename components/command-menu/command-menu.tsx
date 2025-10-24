"use client";

import { useCallback, useEffect, useState } from "react";
import { Command, CommandDialog, CommandList } from "@/components/ui/command";
import { Footer } from "./presentation/footer";
import { SearchInput } from "./presentation/search-input";
import { MainCommands } from "./sections/main-commands";
import { ResourceGroupsList } from "./sections/resource-groups-list";
import { SnapshotsList } from "./sections/snapshots-list";
import { WorkspacesList } from "./sections/workspaces-list";
import type { CommandMenuProps, FooterProps, MenuMode } from "./types";

export function CommandMenu({
  workspaceId,
  open: externalOpen,
  onOpenChange,
  onOpenSettings,
  onOpenCreateWorkspace,
  onOpenAICleanReview,
  onOpenCreateResourceGroup,
  onSelectResourceGroup,
  onMoveToResourceGroup,
  initialMenuMode = "main",
}: CommandMenuProps) {
  const isControlled = externalOpen !== undefined && onOpenChange !== undefined;

  const [internalOpen, setInternalOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<MenuMode>(initialMenuMode);
  const [searchValue, setSearchValue] = useState("");
  const [selectedValue, setSelectedValue] = useState("");
  const [footerProps, setFooterProps] = useState<FooterProps>({
    enterText: "Select command",
    shortcuts: [],
  });

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
      // Reset to initial menu mode and clear search when closing
      if (!newOpen) {
        setMenuMode(initialMenuMode);
        setSearchValue("");
        setSelectedValue("");
      }
    },
    [isControlled, onOpenChange, initialMenuMode],
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return;

      // Ctrl+H or Ctrl+Left Arrow to go back in workspaces or snapshots mode
      if (menuMode === "workspaces" || menuMode === "snapshots") {
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

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <Command value={selectedValue} onValueChange={setSelectedValue}>
        <SearchInput
          menuMode={menuMode}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
        />
        <CommandList className="scrollbar-none">
          {menuMode === "main" && (
            <MainCommands
              workspaceId={workspaceId}
              onOpenSettings={onOpenSettings}
              onOpenCreateWorkspace={onOpenCreateWorkspace}
              onOpenAICleanReview={onOpenAICleanReview}
              onOpenCreateResourceGroup={onOpenCreateResourceGroup}
              searchValue={searchValue}
              setMenuMode={(mode) => {
                // Clear search and selection when switching modes to avoid
                // transient empty states while Dexie queries initialize.
                setSearchValue("");
                setSelectedValue("");
                setMenuMode(mode);
              }}
              onClose={handleOpenChange.bind(null, false)}
              setFooterProps={setFooterProps}
            />
          )}

          {menuMode === "workspaces" && (
            <WorkspacesList
              selectedValue={selectedValue}
              onClose={handleOpenChange.bind(null, false)}
              setFooterProps={setFooterProps}
            />
          )}

          {menuMode === "snapshots" && (
            <SnapshotsList
              workspaceId={workspaceId}
              selectedValue={selectedValue}
              onClose={handleOpenChange.bind(null, false)}
              setFooterProps={setFooterProps}
            />
          )}

          {menuMode === "resourceGroups" && onSelectResourceGroup && (
            <ResourceGroupsList
              selectedValue={selectedValue}
              onSelectResourceGroup={onSelectResourceGroup}
              onMoveToResourceGroup={onMoveToResourceGroup}
              onClose={handleOpenChange.bind(null, false)}
              setFooterProps={setFooterProps}
            />
          )}
        </CommandList>

        <Footer {...footerProps} />
      </Command>
    </CommandDialog>
  );
}
