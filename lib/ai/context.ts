/**
 * AI Context Builder for Workspace Analysis
 * Provides hierarchical workspace context (windows → groups → tabs) for AI features
 *
 * This context enables AI to understand:
 * - Window organization and focus state
 * - Existing tab groups and their composition
 * - Tab properties (pinned, audible, etc.) for smarter decisions
 * - Overall workspace structure for contextual naming/grouping
 */

import { browser } from "wxt/browser";
import { db } from "@/lib/db/db";

/**
 * Hierarchical workspace context for AI analysis
 * Groups tabs by windows and includes existing groups for better decision-making
 *
 * Structure:
 * - windows[]: Each window contains its groups and tabs
 * - groups[]: Existing tab groups with their member tab IDs
 * - tabs[]: All active tabs with metadata for AI decision-making
 */
export interface WorkspaceContext {
  workspaceId: number;
  windows: Array<{
    windowId: number;
    focused?: boolean;
    incognito?: boolean;
    groups: Array<{
      id: number;
      title?: string;
      color?: string;
      collapsed?: boolean;
      tabIds: number[];
    }>;
    tabs: Array<{
      id: number;
      title: string;
      url: string;
      pinned?: boolean;
      audible?: boolean;
      muted?: boolean;
      discarded?: boolean;
      groupId?: number | null;
      lastAccessed?: number;
    }>;
  }>;
  tabCount: number;
  groupCount: number;
}

/**
 * Build hierarchical workspace context for AI analysis
 * Includes windows, groups, and tabs organized by window
 */
export async function buildWorkspaceAIContext(
  workspaceId: number,
): Promise<WorkspaceContext> {
  try {
    // Get all active tabs in the workspace
    const workspaceTabs = await db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .filter((tab) => tab.tabStatus === "active")
      .toArray();

    // Get all active tab groups in the workspace
    const workspaceGroups = await db.tabGroups
      .where("workspaceId")
      .equals(workspaceId)
      .filter((group) => group.groupStatus === "active")
      .toArray();

    // Group tabs by windowId (filter out tabs without windowId or id)
    const tabsByWindow = new Map<number, typeof workspaceTabs>();
    for (const tab of workspaceTabs) {
      if (tab.windowId !== undefined && tab.id !== undefined) {
        if (!tabsByWindow.has(tab.windowId)) {
          tabsByWindow.set(tab.windowId, []);
        }
        tabsByWindow.get(tab.windowId)?.push(tab);
      }
    }

    // Group tab groups by windowId
    const groupsByWindow = new Map<number, typeof workspaceGroups>();
    for (const group of workspaceGroups) {
      if (group.windowId !== undefined) {
        if (!groupsByWindow.has(group.windowId)) {
          groupsByWindow.set(group.windowId, []);
        }
        groupsByWindow.get(group.windowId)?.push(group);
      }
    }

    // Get window details for all windows that have tabs in this workspace
    const windowIds = Array.from(tabsByWindow.keys());
    const windows: WorkspaceContext["windows"] = [];

    for (const windowId of windowIds) {
      try {
        const windowInfo = await browser.windows.get(windowId, {
          populate: false,
        });

        const windowGroups = groupsByWindow.get(windowId) || [];
        const windowTabs = tabsByWindow.get(windowId) || [];

        // Build group details with their tab IDs
        const groups = windowGroups.map((group) => ({
          id: group.id,
          title: group.title,
          color: group.color,
          collapsed: group.collapsed,
          tabIds: windowTabs
            .filter((tab) => tab.groupId === group.id)
            .map((tab) => tab.id as number),
        }));

        // Build tab details
        const tabs = windowTabs.map((tab) => ({
          id: tab.id as number,
          title: tab.title || "Untitled",
          url: tab.url || "",
          pinned: tab.pinned,
          audible: tab.audible,
          muted: tab.mutedInfo?.muted,
          discarded: tab.discarded,
          groupId: tab.groupId,
          lastAccessed: tab.lastAccessed,
        }));

        windows.push({
          windowId,
          focused: windowInfo.focused,
          incognito: windowInfo.incognito,
          groups,
          tabs,
        });
      } catch (error) {
        console.warn(`Failed to get details for window ${windowId}:`, error);
        // Still include the window with available data
        const windowGroups = groupsByWindow.get(windowId) || [];
        const windowTabs = tabsByWindow.get(windowId) || [];

        const groups = windowGroups.map((group) => ({
          id: group.id,
          title: group.title,
          color: group.color,
          collapsed: group.collapsed,
          tabIds: windowTabs
            .filter((tab) => tab.groupId === group.id)
            .map((tab) => tab.id as number),
        }));

        const tabs = windowTabs.map((tab) => ({
          id: tab.id as number,
          title: tab.title || "Untitled",
          url: tab.url || "",
          pinned: tab.pinned,
          audible: tab.audible,
          muted: tab.mutedInfo?.muted,
          discarded: tab.discarded,
          groupId: tab.groupId,
          lastAccessed: tab.lastAccessed,
        }));

        windows.push({
          windowId,
          groups,
          tabs,
        });
      }
    }

    return {
      workspaceId,
      windows,
      tabCount: workspaceTabs.length,
      groupCount: workspaceGroups.length,
    };
  } catch (error) {
    console.error(
      `❌ Failed to build AI context for workspace ${workspaceId}:`,
      error,
    );
    throw error;
  }
}
