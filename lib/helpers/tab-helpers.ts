import { browser } from "wxt/browser";
import type { Tab } from "@/lib/types/types";

/**
 * Finds a tab by its string ID in an array of tabs
 */
export function findTabById(tabs: Tab[], id: string): Tab | undefined {
  return tabs.find((tab) => tab.id?.toString() === id);
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
