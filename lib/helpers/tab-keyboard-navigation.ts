import type { Tab } from "@/lib/types/types";

export interface TabKeyboardNavigationProps {
  navigableTabs: (Tab & { id: number })[];
  moveTabToPosition: (
    tabIdToMove: number,
    targetTabId: number,
  ) => Promise<void>;
  handleDeleteTab: (id: number) => Promise<void>;
  handleActivateTab: (id: number) => Promise<void>;
  handleRefreshTabs: () => Promise<void>;
  focusedTabId: number | null;
  clipboardTabId: number | null;
  setFocusedTabId: (id: number | null) => void;
  setClipboardTabId: (id: number | null) => void;
  // Visual selection mode
  isVisualMode: boolean;
  visualStartTabId: number | null;
  setIsVisualMode: (mode: boolean) => void;
  setVisualStartTabId: (id: number | null) => void;
  // Selection management
  selectedTabs: number[];
  updateSelectedTabs: (tabs: number[]) => void;
  // Copy functions
  copySingleLink: (tabId: number) => Promise<void>;
  copyMultipleLinks: (tabIds: number[]) => Promise<void>;
  // Resource panel toggle
  toggleShowResources: () => void;
}

export function createTabKeyboardHandler({
  navigableTabs,
  moveTabToPosition,
  handleDeleteTab,
  handleActivateTab,
  handleRefreshTabs,
  focusedTabId,
  clipboardTabId,
  setFocusedTabId,
  setClipboardTabId,
  isVisualMode,
  visualStartTabId,
  setIsVisualMode,
  setVisualStartTabId,
  selectedTabs,
  updateSelectedTabs,
  copySingleLink,
  copyMultipleLinks,
  toggleShowResources,
}: TabKeyboardNavigationProps) {
  // Helper function to update visual selection range
  const updateVisualSelection = (startId: number, endId: number) => {
    const startIndex = navigableTabs.findIndex((tab) => tab.id === startId);
    const endIndex = navigableTabs.findIndex((tab) => tab.id === endId);

    if (startIndex === -1 || endIndex === -1) return;

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    const selectedIds = navigableTabs
      .slice(minIndex, maxIndex + 1)
      .map((tab) => tab.id);

    updateSelectedTabs(selectedIds);
  };

  return (e: KeyboardEvent) => {
    // Only handle if we have tabs and no input is focused
    if (
      !navigableTabs.length ||
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const currentIndex = focusedTabId
      ? navigableTabs.findIndex((tab) => tab.id === focusedTabId)
      : -1;

    switch (e.key) {
      case " ": // Space - toggle selection of focused tab
        e.preventDefault();
        if (focusedTabId) {
          const isSelected = selectedTabs.includes(focusedTabId);
          const newSelected = isSelected
            ? selectedTabs.filter((id) => id !== focusedTabId)
            : [...selectedTabs, focusedTabId];
          updateSelectedTabs(newSelected);
        }
        break;
      case "v": // V - toggle visual selection mode
      case "V":
        e.preventDefault();
        if (isVisualMode) {
          // Exit visual mode
          setIsVisualMode(false);
          setVisualStartTabId(null);
        } else if (focusedTabId) {
          // Enter visual mode with current focused tab as start
          setIsVisualMode(true);
          setVisualStartTabId(focusedTabId);
          // Select just the current tab initially
          updateSelectedTabs([focusedTabId]);
        }
        break;
      case "j": // Down
      case "ArrowDown":
        e.preventDefault();
        if (currentIndex < navigableTabs.length - 1) {
          const newFocusedId = navigableTabs[currentIndex + 1].id;
          setFocusedTabId(newFocusedId);

          // If in visual mode, update selection range
          if (isVisualMode && visualStartTabId) {
            updateVisualSelection(visualStartTabId, newFocusedId);
          }
        }
        break;
      case "k": // Up
      case "ArrowUp":
        e.preventDefault();
        if (currentIndex > 0) {
          const newFocusedId = navigableTabs[currentIndex - 1].id;
          setFocusedTabId(newFocusedId);

          // If in visual mode, update selection range
          if (isVisualMode && visualStartTabId) {
            updateVisualSelection(visualStartTabId, newFocusedId);
          }
        } else if (navigableTabs.length > 0) {
          const newFocusedId = navigableTabs[0].id;
          setFocusedTabId(newFocusedId);

          // If in visual mode, update selection range
          if (isVisualMode && visualStartTabId) {
            updateVisualSelection(visualStartTabId, newFocusedId);
          }
        }
        break;
      case "d": // dd for cut
        if (e.key === "d" && !e.repeat) {
          // Wait for second 'd'
          let timeout: NodeJS.Timeout;
          const secondDHandler = (e2: KeyboardEvent) => {
            if (e2.key === "d") {
              e2.preventDefault();
              if (focusedTabId) {
                const tabToCut = navigableTabs.find(
                  (tab) => tab.id === focusedTabId,
                );
                if (tabToCut) {
                  setClipboardTabId(focusedTabId);
                  // Move to next tab or previous
                  const nextIndex = Math.min(
                    currentIndex + 1,
                    navigableTabs.length - 1,
                  );
                  setFocusedTabId(navigableTabs[nextIndex]?.id ?? null);
                }
              }
            }
            document.removeEventListener("keydown", secondDHandler);
            clearTimeout(timeout);
          };

          timeout = setTimeout(() => {
            document.removeEventListener("keydown", secondDHandler);
          }, 500);

          document.addEventListener("keydown", secondDHandler);
        }
        break;
      case "p": // p for paste (move tab to focused position)
        e.preventDefault();
        if (clipboardTabId && focusedTabId && clipboardTabId !== focusedTabId) {
          // Move clipboard tab to focused position
          moveTabToPosition(clipboardTabId, focusedTabId);
          setClipboardTabId(null);
        }
        break;
      case "x": // x for delete focused tab
        e.preventDefault();
        if (focusedTabId) {
          // Calculate next focus position before deletion
          const currentIndex = navigableTabs.findIndex(
            (tab) => tab.id === focusedTabId,
          );
          let nextFocusId = null;

          if (navigableTabs.length > 1) {
            if (currentIndex === navigableTabs.length - 1) {
              // Last tab, move to previous
              nextFocusId = navigableTabs[currentIndex - 1].id;
            } else {
              // Not last tab, move to next
              nextFocusId = navigableTabs[currentIndex + 1].id;
            }
          }
          // If only one tab, focus will be cleared naturally when tabs update

          // Delete the tab
          handleDeleteTab(focusedTabId);

          // Set new focus immediately for better UX
          setFocusedTabId(nextFocusId);
        }
        break;
      case "y": // y for copy links, yy for single link
        if (e.key === "y" && !e.repeat) {
          // Wait for second 'y'
          let timeout: NodeJS.Timeout;
          const secondYHandler = (e2: KeyboardEvent) => {
            if (e2.key === "y") {
              e2.preventDefault();
              if (focusedTabId) {
                copySingleLink(focusedTabId);
              }
            }
            document.removeEventListener("keydown", secondYHandler);
            clearTimeout(timeout);
          };

          timeout = setTimeout(() => {
            document.removeEventListener("keydown", secondYHandler);
            // Single 'y' - copy selected tabs if any
            if (selectedTabs.length > 0) {
              copyMultipleLinks(selectedTabs);
            }
          }, 500);

          document.addEventListener("keydown", secondYHandler);
        }
        break;
      case "Enter":
        e.preventDefault();
        if (focusedTabId) {
          handleActivateTab(focusedTabId);
        }
        break;
      case "g": // gg for go to first tab
        if (e.key === "g" && !e.repeat) {
          // Wait for second 'g'
          let timeout: NodeJS.Timeout;
          const secondGHandler = (e2: KeyboardEvent) => {
            if (e2.key === "g") {
              e2.preventDefault();
              if (navigableTabs.length > 0) {
                setFocusedTabId(navigableTabs[0].id);
              }
            }
            document.removeEventListener("keydown", secondGHandler);
            clearTimeout(timeout);
          };

          timeout = setTimeout(() => {
            document.removeEventListener("keydown", secondGHandler);
          }, 500);

          document.addEventListener("keydown", secondGHandler);
        }
        break;
      case "G": // G for go to last tab
        e.preventDefault();
        if (navigableTabs.length > 0) {
          setFocusedTabId(navigableTabs[navigableTabs.length - 1].id);
        }
        break;
      case "r": // r for refresh tabs
        // e.preventDefault();
        handleRefreshTabs();
        break;
      case "R": // R for toggle show resources
        e.preventDefault();
        toggleShowResources();
        break;
      case "Escape":
        setFocusedTabId(null);
        setClipboardTabId(null);
        // Exit visual mode if active
        if (isVisualMode) {
          setIsVisualMode(false);
          setVisualStartTabId(null);
        }
        break;
    }
  };
}
