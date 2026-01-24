import { useCallback, useEffect } from "react";
import { useToggleState } from "@/hooks/use-state";

interface GlobalKeybindingsProps {
  onOpenKeybindingsDialog: () => void;
  onRefreshTabs: () => Promise<void>;
}

/**
 * Hook for global keybindings that should work regardless of tab state.
 * These keybindings are always available, even when there are no tabs.
 */
export function useGlobalKeybindings({
  onOpenKeybindingsDialog,
  onRefreshTabs,
}: GlobalKeybindingsProps) {
  const { toggle: toggleShowResources } = useToggleState("showResources");

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      // Don't handle if input is focused
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "?":
          e.preventDefault();
          onOpenKeybindingsDialog();
          break;
        case "r": // r for refresh tabs
          // Don't prevent default to allow browser refresh with Cmd+R
          onRefreshTabs();
          break;
        case "R": // R for toggle show resources
          e.preventDefault();
          toggleShowResources();
          break;
      }
    },
    [onOpenKeybindingsDialog, onRefreshTabs, toggleShowResources],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
