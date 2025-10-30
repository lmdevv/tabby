/**
 * AI Context Builder for Workspace Analysis
 * Provides simplified workspace context for AI features
 *
 * This context enables AI to understand:
 * - Existing tab groups with titles and colors
 * - Tab information (id, title, url, group membership)
 * - Window organization only when multiple windows exist
 */

import { db } from "@/lib/db/db";
import { UNGROUPED_TAB_GROUP_ID } from "@/lib/types/constants";

/**
 * Helper function to identify dashboard tabs
 */
function isDashboardTab(tab: { url?: string }): boolean {
  if (!tab.url) return false;
  // Check if URL is the extension's dashboard page
  return tab.url.includes("dashboard.html") || tab.url.includes("/dashboard");
}

/**
 * Simplified workspace context for AI analysis
 * Provides essential information about groups and tabs for AI decision-making
 *
 * Structure:
 * - groups[]: Existing tab groups with title and color
 * - tabs[]: All active tabs with basic info and group membership
 * - windows[]: Window organization (only included if multiple windows exist)
 */
export interface WorkspaceContext {
  workspaceId: number;
  groups: Array<{
    id: number;
    title?: string;
    color?: string;
  }>;
  tabs: Array<{
    id: number;
    title: string;
    url: string;
    groupId?: number | null;
  }>;
  windows?: Array<{
    windowId: number;
    tabIds: number[];
  }>;
}

/**
 * Build simplified workspace context for AI analysis
 * Includes groups and tabs, with window info only when multiple windows exist
 */
export async function buildWorkspaceAIContext(
  workspaceId: number,
): Promise<WorkspaceContext> {
  try {
    // Get all active tabs in the workspace
    const allWorkspaceTabs = await db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .filter((tab) => tab.tabStatus === "active")
      .toArray();

    // Filter out dashboard tabs
    const dashboardTabs = allWorkspaceTabs.filter((tab) =>
      isDashboardTab({ url: tab.url }),
    );
    const workspaceTabs = allWorkspaceTabs.filter(
      (tab) => !isDashboardTab({ url: tab.url }),
    );

    if (dashboardTabs.length > 0) {
      console.log(
        `ℹ️ Filtered out ${dashboardTabs.length} dashboard tab(s) from AI context`,
      );
    }

    // Get all active tab groups in the workspace
    const workspaceGroups = await db.tabGroups
      .where("workspaceId")
      .equals(workspaceId)
      .filter((group) => group.groupStatus === "active")
      .toArray();

    // Group tabs by windowId to determine if we need window structure
    const tabsByWindow = new Map<number, typeof workspaceTabs>();
    for (const tab of workspaceTabs) {
      if (tab.windowId !== undefined && tab.id !== undefined) {
        if (!tabsByWindow.has(tab.windowId)) {
          tabsByWindow.set(tab.windowId, []);
        }
        tabsByWindow.get(tab.windowId)?.push(tab);
      }
    }

    // Build simplified groups
    const groups = workspaceGroups.map((group) => ({
      id: group.id,
      title: group.title,
      color: group.color,
    }));

    // Build simplified tabs
    const tabs = workspaceTabs
      .filter((tab) => tab.id !== undefined)
      .map((tab) => {
        const tabData: {
          id: number;
          title: string;
          url: string;
          groupId?: number;
        } = {
          id: tab.id as number,
          title: tab.title || "Untitled",
          url: tab.url || "",
        };
        // Only include groupId if the tab actually belongs to a group (not ungrouped)
        if (
          tab.groupId !== UNGROUPED_TAB_GROUP_ID &&
          tab.groupId !== null &&
          tab.groupId !== undefined
        ) {
          tabData.groupId = tab.groupId;
        }
        return tabData;
      });

    // Only include windows if there are multiple
    const windowIds = Array.from(tabsByWindow.keys());
    let windows: WorkspaceContext["windows"];

    if (windowIds.length > 1) {
      windows = windowIds.map((windowId) => ({
        windowId,
        tabIds:
          tabsByWindow.get(windowId)?.map((tab) => tab.id as number) || [],
      }));
    }

    return {
      workspaceId,
      groups,
      tabs,
      windows,
    };
  } catch (error) {
    console.error(
      `❌ Failed to build AI context for workspace ${workspaceId}:`,
      error,
    );
    throw error;
  }
}
