import { browser } from "wxt/browser";
import type { Tab } from "@/lib/types/types";

/**
 * Finds a tab by its string ID in an array of tabs
 */
export function findTabById(tabs: Tab[], id: string): Tab | undefined {
  return tabs.find((tab) => tab.id?.toString() === id);
}

/**
 * Get a random color for tab groups
 */
export function getRandomTabGroupColor():
  | "blue"
  | "cyan"
  | "green"
  | "grey"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "yellow" {
  const colors: Array<
    | "blue"
    | "cyan"
    | "green"
    | "grey"
    | "orange"
    | "pink"
    | "purple"
    | "red"
    | "yellow"
  > = [
    "grey",
    "blue",
    "red",
    "yellow",
    "green",
    "pink",
    "purple",
    "cyan",
    "orange",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Ungroups a tab if it's part of a group
 */
export async function ungroupTabIfNeeded(tab: Tab): Promise<void> {
  if (tab.groupId && tab.groupId !== -1 && tab.id) {
    try {
      await browser.tabs.ungroup(tab.id);
    } catch (error) {
      console.error("Failed to ungroup tab:", error);
    }
  }
}

/**
 * Sends a message to move a tab to a new index
 */
export async function moveTabInBrowser(
  tabId: number,
  newIndex: number,
): Promise<void> {
  try {
    await browser.runtime.sendMessage({
      type: "moveTab",
      tabId,
      newIndex,
    } as const);
  } catch (error) {
    console.error("Failed to send moveTab message:", error);
  }
}

/**
 * Groups the specified tabs together
 */
export async function groupTabs(tabIds: number[]): Promise<void> {
  if (!tabIds.length) return;

  try {
    if (typeof browser?.tabs?.group === "function") {
      // Get the window ID from the first tab to ensure they group in the same window
      const firstTab = await browser.tabs.get(tabIds[0]);
      await browser.tabs.group({
        tabIds: tabIds as [number, ...number[]],
        createProperties: {
          windowId: firstTab.windowId,
        },
      });
    }
  } catch (error) {
    console.error("Failed to group tabs:", error);
  }
}
