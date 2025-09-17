import type { Tab, Workspace } from "@/lib/types";
import { browser } from "wxt/browser";
import { db } from "./db";
import { isDashboardTab, shiftIndices } from "./helpers";

export function setupTabListeners(
  getActiveWorkspace: () => Workspace | undefined,
) {
  browser.tabs.onCreated.addListener(async (tab) => {
    if (!tab.id || !tab.index || isDashboardTab(tab)) return;

    const activeWorkspace = getActiveWorkspace();
    if (activeWorkspace) {
      // Check if we have an existing tab with the same URL that might be archived
      const dbTab = await db.activeTabs
        .where("workspaceId")
        .equals(activeWorkspace.id)
        .and((t) => t.url === tab.url)
        .first();

      if (dbTab?.tabStatus === "archived") {
        console.log("Found tab archived, returning..");
        return;
      }
    }

    const now = Date.now();
    const newRow: Tab = {
      ...tab,
      stableId: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      tabStatus: "active",
      workspaceId: activeWorkspace ? activeWorkspace.id : -1,
    };

    await db.transaction("rw", db.activeTabs, async () => {
      await shiftIndices(tab.windowId, tab.index, +1);
      await db.activeTabs.put(newRow);
    });
  });

  browser.tabs.onRemoved.addListener(async (tabId) => {
    const dbTab = await db.activeTabs.get(tabId);
    if (!dbTab || dbTab.tabStatus === "archived") return;

    await db.transaction("rw", db.activeTabs, async () => {
      await shiftIndices(dbTab.windowId, dbTab.index + 1, -1);
      await db.activeTabs.delete(tabId);
    });
  });

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const dbTab = await db.activeTabs.get(tabId);
    if (!dbTab || dbTab.tabStatus === "archived" || isDashboardTab(tab)) return;

    const now = Date.now();
    const updated: Tab = {
      ...dbTab,
      ...tab,
      ...changeInfo,
      updatedAt: now,
      // Preserve the stableId from the existing database record
      stableId: dbTab.stableId,
    };

    await db.activeTabs.put(updated);
  });

  // Moving tabs across windows
  browser.tabs.onDetached.addListener(async (tabId, detachInfo) => {
    const dbTab = await db.activeTabs.get(tabId);
    if (!dbTab || dbTab.tabStatus === "archived") return;

    const { oldWindowId, oldPosition } = detachInfo;
    await shiftIndices(oldWindowId, oldPosition + 1, -1);
  });

  browser.tabs.onAttached.addListener(async (tabId, attachInfo) => {
    const dbTab = await db.activeTabs.get(tabId);
    if (!dbTab || dbTab.tabStatus === "archived") return;

    const { newWindowId, newPosition } = attachInfo;
    const now = Date.now();

    await shiftIndices(newWindowId, newPosition, +1);

    // Preserve stableId when updating window/position info
    dbTab.windowId = newWindowId;
    dbTab.index = newPosition;
    dbTab.updatedAt = now;
    // stableId is already preserved in the dbTab object
    await db.activeTabs.put(dbTab);
  });

  // Moving tabs
  browser.tabs.onMoved.addListener(async (tabId, moveInfo) => {
    const dbTab = await db.activeTabs.get(tabId);
    if (!dbTab || dbTab.tabStatus === "archived") return;

    const { windowId, fromIndex: from, toIndex: to } = moveInfo;
    if (from === to) return;

    await db.transaction("rw", db.activeTabs, async () => {
      if (from < to) {
        // shift DOWN
        // TODO: optimize with the helper
        await db.activeTabs
          .where("windowId")
          .equals(windowId)
          .and((t) => t.index > from && t.index <= to)
          .modify((t) => {
            t.index -= 1;
            t.updatedAt = Date.now();
          });
      } else {
        // shift UP
        await db.activeTabs
          .where("windowId")
          .equals(windowId)
          .and((t) => t.index >= to && t.index < from)
          .modify((t) => {
            t.index += 1;
            t.updatedAt = Date.now();
          });
      }

      // moved tab itself - preserve stableId
      dbTab.index = to;
      dbTab.updatedAt = Date.now();
      // stableId is already preserved in the dbTab object
      await db.activeTabs.put(dbTab);
    });
  });
}
