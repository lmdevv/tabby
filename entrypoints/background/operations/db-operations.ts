import { browser } from "wxt/browser";
import { db } from "@/lib/db/db";
import { UNASSIGNED_WORKSPACE_ID } from "@/lib/types/constants";
import type { Tab, TabGroup } from "@/lib/types/types";

export async function shiftIndices(
  windowId: number,
  start: number,
  delta: number, // +1 or –1
) {
  if (delta === 0) return;
  const now = Date.now();

  await db.activeTabs
    .where("windowId")
    .equals(windowId)
    .and((t) => t.index >= start)
    .modify((t) => {
      t.index += delta;
      t.updatedAt = now;
    });
}

export async function reconcileTabs() {
  // simple mutex to avoid concurrent reconciliations
  if ((reconcileTabs as unknown as { _lock?: boolean })._lock) return;
  (reconcileTabs as unknown as { _lock?: boolean })._lock = true;
  const now = Date.now();

  const activeWorkspace = await db.workspaces.where("active").equals(1).first();
  const targetWorkspaceId = activeWorkspace
    ? activeWorkspace.id
    : UNASSIGNED_WORKSPACE_ID;

  // 1. fetch live tabs from Chrome (including all tabs)
  const allLiveTabs = await browser.tabs.query({});
  const liveTabs = allLiveTabs;

  // Create maps for live tabs - both by browser ID and by URL for fallback matching
  const liveTabsByBrowserId = new Map<number, Browser.tabs.Tab>();
  const liveTabsByUrl = new Map<string, Browser.tabs.Tab[]>();

  for (const tab of liveTabs) {
    if (tab.id != null) {
      liveTabsByBrowserId.set(tab.id, tab);
    }
    if (tab.url) {
      if (!liveTabsByUrl.has(tab.url)) {
        liveTabsByUrl.set(tab.url, []);
      }
      const urlTabs = liveTabsByUrl.get(tab.url);
      if (urlTabs) {
        urlTabs.push(tab);
      }
    }
  }

  // 2. fetch stored tabs from IndexedDB - ONLY for the target workspace
  const storedTabs = await db.activeTabs
    .where("workspaceId")
    .equals(targetWorkspaceId)
    .and((tab) => tab.tabStatus === "active")
    .toArray();

  // Create maps for stored tabs by browser ID and stableId
  const storedTabsByBrowserId = new Map<number, Tab>();
  const storedTabsByStableId = new Map<string, Tab>();
  const storedTabsByUrl = new Map<string, Tab[]>();

  for (const tab of storedTabs) {
    if (tab.id != null) {
      storedTabsByBrowserId.set(tab.id, tab);
    }
    storedTabsByStableId.set(tab.stableId, tab);
    if (tab.url) {
      if (!storedTabsByUrl.has(tab.url)) {
        storedTabsByUrl.set(tab.url, []);
      }
      const urlTabs = storedTabsByUrl.get(tab.url);
      if (urlTabs) {
        urlTabs.push(tab);
      }
    }
  }

  // Track which tabs have been matched to avoid duplicates
  const matchedLiveTabIds = new Set<number>();
  const matchedStoredStableIds = new Set<string>();

  // 3. Primary matching: by browser tab ID (most reliable for existing tabs)
  for (const [browserId, liveTab] of liveTabsByBrowserId.entries()) {
    const storedTab = storedTabsByBrowserId.get(browserId);
    if (storedTab) {
      matchedLiveTabIds.add(browserId);
      matchedStoredStableIds.add(storedTab.stableId);

      // Update stored tab with current browser state while preserving stableId
      const fieldsToCheck: (keyof Browser.tabs.Tab)[] = [
        "url",
        "title",
        "pinned",
        "index",
        "groupId",
        "windowId",
      ];

      let hasChanges = false;
      const diffs: Array<{ field: string; old: unknown; new: unknown }> = [];

      for (const field of fieldsToCheck) {
        const oldVal = storedTab[field];
        const newVal = liveTab[field];
        if (oldVal !== newVal) {
          hasChanges = true;
          diffs.push({ field, old: oldVal, new: newVal });
        }
      }

      if (hasChanges) {
        console.log(
          `✏ [Tab ${browserId} – "${liveTab.title}"] detected changes:`,
        );
        for (const { field, old, new: newer } of diffs) {
          console.log(`   • ${field}:`, `"${old}"`, "→", `"${newer}"`);
        }
        await db.activeTabs.put({
          ...storedTab,
          ...liveTab,
          updatedAt: now,
          stableId: storedTab.stableId, // Preserve stableId
        } as Tab);
      }
    }
  }

  // 4. Secondary matching: by URL for tabs that lost their browser ID (moved windows, etc.)
  for (const [browserId, liveTab] of liveTabsByBrowserId.entries()) {
    if (matchedLiveTabIds.has(browserId) || !liveTab.url) continue;

    const candidateStoredTabs = storedTabsByUrl.get(liveTab.url) || [];

    // Find an unmatched stored tab with the same URL
    const unmatchedStoredTab = candidateStoredTabs.find(
      (tab) => !matchedStoredStableIds.has(tab.stableId),
    );

    if (unmatchedStoredTab) {
      matchedLiveTabIds.add(browserId);
      matchedStoredStableIds.add(unmatchedStoredTab.stableId);

      console.log(
        `🔗 [Tab ${browserId}] matched by URL to stableId ${unmatchedStoredTab.stableId}: ${liveTab.title}`,
      );

      // Update the stored tab with new browser ID and current state
      await db.activeTabs.put({
        ...unmatchedStoredTab,
        ...liveTab,
        updatedAt: now,
        stableId: unmatchedStoredTab.stableId, // Preserve stableId
      } as Tab);
    }
  }

  // 5. Handle new tabs (no match found by ID or URL)
  for (const [browserId, liveTab] of liveTabsByBrowserId.entries()) {
    if (!matchedLiveTabIds.has(browserId)) {
      console.log(
        `🆕 [Tab ${browserId}] new tab added:`,
        liveTab.title,
        liveTab.url,
      );
      await db.activeTabs.put({
        ...liveTab,
        stableId: crypto.randomUUID(),
        workspaceId: targetWorkspaceId,
        createdAt: now,
        updatedAt: now,
        tabStatus: "active",
      } satisfies Tab);
    }
  }

  // 6. Handle removed tabs (stored tabs with no live match)
  // First, identify all tabs that should be removed
  const tabsToRemove = storedTabs.filter(
    (tab) => !matchedStoredStableIds.has(tab.stableId),
  );

  if (tabsToRemove.length > 0) {
    // Remove them in a batch for efficiency
    const stableIdsToRemove = tabsToRemove.map((tab) => tab.stableId);
    await db.activeTabs.where("stableId").anyOf(stableIdsToRemove).delete();
  }

  // 7. Final validation - ensure no duplicate browser IDs exist in the database
  const allActiveTabs = await db.activeTabs
    .where("workspaceId")
    .equals(targetWorkspaceId)
    .and((tab) => tab.tabStatus === "active")
    .toArray();

  const browserIdCounts = new Map<number, number>();
  const duplicateBrowserIds: number[] = [];

  for (const tab of allActiveTabs) {
    if (tab.id != null) {
      const count = browserIdCounts.get(tab.id) || 0;
      browserIdCounts.set(tab.id, count + 1);
      if (count === 1) {
        duplicateBrowserIds.push(tab.id);
      }
    }
  }

  // Clean up any duplicate browser IDs by keeping the most recently updated entry
  for (const duplicateId of duplicateBrowserIds) {
    const duplicateTabs = allActiveTabs.filter((tab) => tab.id === duplicateId);
    if (duplicateTabs.length > 1) {
      // Sort by updatedAt (most recent first) and keep the first one
      duplicateTabs.sort((a, b) => b.updatedAt - a.updatedAt);
      const tabsToDelete = duplicateTabs.slice(1);

      for (const tabToDelete of tabsToDelete) {
        await db.activeTabs
          .where("stableId")
          .equals(tabToDelete.stableId)
          .delete();
      }
    }
  }

  // 8. Keep archived tabs for workspace state persistence across switches
  (reconcileTabs as unknown as { _lock?: boolean })._lock = false;
}

/**
 * Hard refresh: Rebuilds DB state 1:1 from browser state
 * Used on browser startup when auto-rollback is disabled
 * This ensures DB exactly matches what browser restored
 */
export async function hardRefreshTabsAndGroups(): Promise<void> {
  const now = Date.now();
  const activeWorkspace = await db.workspaces.where("active").equals(1).first();
  const targetWorkspaceId = activeWorkspace
    ? activeWorkspace.id
    : UNASSIGNED_WORKSPACE_ID;

  // Query all tabs and groups from browser
  const [liveTabs, liveGroups] = await Promise.all([
    browser.tabs.query({}),
    browser.tabGroups.query({}),
  ]);

  // Clear all active tabs and groups for the target workspace
  await db.transaction("rw", db.activeTabs, db.tabGroups, async () => {
    // Clear active tabs
    await db.activeTabs
      .where("workspaceId")
      .equals(targetWorkspaceId)
      .and((tab) => tab.tabStatus === "active")
      .delete();

    // Archive all active groups for this workspace (preserve archived ones)
    const activeGroups = await db.tabGroups
      .where("workspaceId")
      .equals(targetWorkspaceId)
      .and((g) => g.groupStatus === "active")
      .toArray();

    for (const group of activeGroups) {
      await db.tabGroups.put({
        ...group,
        groupStatus: "archived" as const,
        updatedAt: now,
      });
    }
  });

  // Rebuild tabs 1:1 from browser state
  const tabsToAdd: Tab[] = liveTabs.map(
    (t): Tab => ({
      ...t,
      stableId: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      tabStatus: "active",
      workspaceId: targetWorkspaceId,
    }),
  );

  await db.activeTabs.bulkPut(tabsToAdd);

  // Rebuild groups 1:1 from browser state
  const groupsToAdd: TabGroup[] = liveGroups.map(
    (g): TabGroup => ({
      ...g,
      stableId: crypto.randomUUID(),
      workspaceId: targetWorkspaceId,
      groupStatus: "active",
      createdAt: now,
      updatedAt: now,
    }),
  );

  // Use bulkPut instead of bulkAdd to handle potential conflicts
  if (groupsToAdd.length > 0) {
    try {
      await db.tabGroups.bulkPut(groupsToAdd);
    } catch (bulkError) {
      // Fall back to individual puts if bulkPut fails
      console.warn(
        "bulkPut failed in hardRefresh, falling back to individual operations:",
        bulkError,
      );
      for (const group of groupsToAdd) {
        try {
          await db.tabGroups.put(group);
        } catch (err) {
          console.error(`Failed to add group ${group.id}:`, err);
        }
      }
    }
  }

  console.log(
    `🔄 Hard refresh completed: ${tabsToAdd.length} tabs, ${groupsToAdd.length} groups synced`,
  );
}
