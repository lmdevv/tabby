import type { Tab } from "@/lib/types/types";

export interface TabKeyboardNavigationProps {
  navigableTabs: (Tab & { id: number })[];
  moveTabToPosition: (
    tabIdToMove: number,
    targetTabId: number,
  ) => Promise<void>;
  handleDeleteTab: (id: number) => Promise<void>;
  handleActivateTab: (id: number) => Promise<void>;
  focusedTabId: number | null;
  clipboardTabId: number | null;
  setFocusedTabId: (id: number | null) => void;
  setClipboardTabId: (id: number | null) => void;
}

export function createTabKeyboardHandler({
  navigableTabs,
  moveTabToPosition,
  handleDeleteTab,
  handleActivateTab,
  focusedTabId,
  clipboardTabId,
  setFocusedTabId,
  setClipboardTabId,
}: TabKeyboardNavigationProps) {
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
      case "j": // Down
      case "ArrowDown":
        e.preventDefault();
        if (currentIndex < navigableTabs.length - 1) {
          setFocusedTabId(navigableTabs[currentIndex + 1].id);
        }
        break;
      case "k": // Up
      case "ArrowUp":
        e.preventDefault();
        if (currentIndex > 0) {
          setFocusedTabId(navigableTabs[currentIndex - 1].id);
        } else if (navigableTabs.length > 0) {
          setFocusedTabId(navigableTabs[0].id);
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
      case "Escape":
        setFocusedTabId(null);
        setClipboardTabId(null);
        break;
    }
  };
}
