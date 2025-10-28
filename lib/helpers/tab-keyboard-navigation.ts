import { browser } from "wxt/browser";
import type { Tab } from "@/lib/types/types";

export type NavigableItem =
  | { type: "tab"; tab: Tab & { id: number } }
  | { type: "groupHeader"; groupId: number; collapsed: boolean; title: string };

export interface TabKeyboardNavigationProps {
  navigableItems: NavigableItem[];
  moveTabToPosition: (
    tabIdToMove: number,
    targetTabId: number,
  ) => Promise<void>;
  handleDeleteTab: (id: number) => Promise<void>;
  handleActivateTab: (id: number) => Promise<void>;
  handleRefreshTabs: () => Promise<void>;
  focusedTabId: number | null;
  focusedGroupId: number | null;
  clipboardTabId: number | null;
  setFocusedTabId: (id: number | null) => void;
  setFocusedGroupId: (id: number | null) => void;
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
  // Group tabs function
  groupTabs: (tabIds: number[]) => Promise<void>;
  // Toggle group collapse
  toggleGroupCollapse: (groupId: number) => Promise<void>;
  // Window activity
  isActiveWindow: boolean;
}

export function createTabKeyboardHandler({
  navigableItems,
  moveTabToPosition,
  handleDeleteTab,
  handleActivateTab,
  handleRefreshTabs,
  focusedTabId,
  focusedGroupId,
  clipboardTabId,
  setFocusedTabId,
  setFocusedGroupId,
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
  groupTabs,
  toggleGroupCollapse,
  isActiveWindow,
}: TabKeyboardNavigationProps) {
  // Helper function to get only tab items for visual selection
  const tabItems = navigableItems.filter(
    (item) => item.type === "tab",
  ) as Array<{ type: "tab"; tab: Tab & { id: number } }>;

  // Helper function to update visual selection range
  const updateVisualSelection = (startId: number, endId: number) => {
    const startIndex = tabItems.findIndex((item) => item.tab.id === startId);
    const endIndex = tabItems.findIndex((item) => item.tab.id === endId);

    if (startIndex === -1 || endIndex === -1) return;

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    const selectedIds = tabItems
      .slice(minIndex, maxIndex + 1)
      .map((item) => item.tab.id);

    updateSelectedTabs(selectedIds);
  };

  return async (e: KeyboardEvent) => {
    // Only handle if we have items and no input is focused
    if (
      !navigableItems.length ||
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      !isActiveWindow
    ) {
      return;
    }

    // Find current focused item index
    let currentIndex = -1;
    if (focusedTabId) {
      currentIndex = navigableItems.findIndex(
        (item) => item.type === "tab" && item.tab.id === focusedTabId,
      );
    } else if (focusedGroupId) {
      currentIndex = navigableItems.findIndex(
        (item) =>
          item.type === "groupHeader" && item.groupId === focusedGroupId,
      );
    }

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
        if (currentIndex < navigableItems.length - 1) {
          const nextItem = navigableItems[currentIndex + 1];
          if (nextItem.type === "tab") {
            setFocusedTabId(nextItem.tab.id);
            setFocusedGroupId(null);
            // If in visual mode, update selection range
            if (isVisualMode && visualStartTabId) {
              updateVisualSelection(visualStartTabId, nextItem.tab.id);
            }
          } else if (nextItem.type === "groupHeader") {
            setFocusedGroupId(nextItem.groupId);
            setFocusedTabId(null);
          }
        }
        break;
      case "k": // Up
      case "ArrowUp":
        e.preventDefault();
        if (currentIndex > 0) {
          const prevItem = navigableItems[currentIndex - 1];
          if (prevItem.type === "tab") {
            setFocusedTabId(prevItem.tab.id);
            setFocusedGroupId(null);
            // If in visual mode, update selection range
            if (isVisualMode && visualStartTabId) {
              updateVisualSelection(visualStartTabId, prevItem.tab.id);
            }
          } else if (prevItem.type === "groupHeader") {
            setFocusedGroupId(prevItem.groupId);
            setFocusedTabId(null);
          }
        } else if (navigableItems.length > 0) {
          const firstItem = navigableItems[0];
          if (firstItem.type === "tab") {
            setFocusedTabId(firstItem.tab.id);
            setFocusedGroupId(null);
            // If in visual mode, update selection range
            if (isVisualMode && visualStartTabId) {
              updateVisualSelection(visualStartTabId, firstItem.tab.id);
            }
          } else if (firstItem.type === "groupHeader") {
            setFocusedGroupId(firstItem.groupId);
            setFocusedTabId(null);
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
                const tabToCut = tabItems.find(
                  (item) => item.tab.id === focusedTabId,
                );
                if (tabToCut) {
                  setClipboardTabId(focusedTabId);
                  // Move to next tab or previous
                  const nextIndex = Math.min(
                    currentIndex + 1,
                    navigableItems.length - 1,
                  );
                  const nextItem = navigableItems[nextIndex];
                  if (nextItem?.type === "tab") {
                    setFocusedTabId(nextItem.tab.id);
                    setFocusedGroupId(null);
                  } else if (nextItem?.type === "groupHeader") {
                    setFocusedGroupId(nextItem.groupId);
                    setFocusedTabId(null);
                  } else {
                    setFocusedTabId(null);
                    setFocusedGroupId(null);
                  }
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
      case "x": // x for delete tab(s)
        e.preventDefault();
        if (selectedTabs.length > 0) {
          // Close all selected tabs
          try {
            await browser.tabs.remove(selectedTabs);
            // Clear selection after closing
            updateSelectedTabs([]);
          } catch (error) {
            console.error("Failed to close selected tabs:", error);
          }
        } else if (focusedTabId) {
          // Close single focused tab (original behavior)
          // Calculate next focus position before deletion
          const tabIndex = tabItems.findIndex(
            (item) => item.tab.id === focusedTabId,
          );
          let nextFocusId = null;

          if (tabItems.length > 1) {
            if (tabIndex === tabItems.length - 1) {
              // Last tab, move to previous
              nextFocusId = tabItems[tabIndex - 1].tab.id;
            } else {
              // Not last tab, move to next
              nextFocusId = tabItems[tabIndex + 1].tab.id;
            }
          }
          // If only one tab, focus will be cleared naturally when tabs update

          // Delete the tab
          handleDeleteTab(focusedTabId);

          // Set new focus immediately for better UX
          setFocusedTabId(nextFocusId);
          setFocusedGroupId(null);
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
        } else if (focusedGroupId) {
          toggleGroupCollapse(focusedGroupId);
        }
        break;
      case "g": // g for group selected tabs, gg for go to first tab
        if (e.key === "g" && !e.repeat) {
          // If there are selected tabs, group them immediately
          if (selectedTabs.length > 1) {
            e.preventDefault();
            groupTabs(selectedTabs);
            // Clear selection after grouping
            updateSelectedTabs([]);
            return;
          }

          // Otherwise, wait for second 'g' for go to first tab
          let timeout: NodeJS.Timeout;
          const secondGHandler = (e2: KeyboardEvent) => {
            if (e2.key === "g") {
              e2.preventDefault();
              if (navigableItems.length > 0) {
                const firstItem = navigableItems[0];
                if (firstItem.type === "tab") {
                  setFocusedTabId(firstItem.tab.id);
                  setFocusedGroupId(null);
                } else if (firstItem.type === "groupHeader") {
                  setFocusedGroupId(firstItem.groupId);
                  setFocusedTabId(null);
                }
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
      case "G": // G for go to last item
        e.preventDefault();
        if (navigableItems.length > 0) {
          const lastItem = navigableItems[navigableItems.length - 1];
          if (lastItem.type === "tab") {
            setFocusedTabId(lastItem.tab.id);
            setFocusedGroupId(null);
          } else if (lastItem.type === "groupHeader") {
            setFocusedGroupId(lastItem.groupId);
            setFocusedTabId(null);
          }
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
      case "a": {
        // a for select/unselect all tabs
        e.preventDefault();
        const allTabIds = tabItems.map((item) => item.tab.id);
        updateSelectedTabs(
          selectedTabs.length === allTabIds.length ? [] : allTabIds,
        );
        break;
      }
      case "Escape":
        setFocusedTabId(null);
        setFocusedGroupId(null);
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
