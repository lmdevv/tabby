import type { Tab } from "@/lib/types";
import { browser } from "wxt/browser";
import { db } from "./db";
import { reconcileTabs, refreshActiveTabs, shiftIndices } from "./helpers";

export default defineBackground(() => {
  (async () => {
    try {
      await db.open();
      console.log("TabManagerDB is open and stores should be available:");

      // Create and open dashboard if not open already
      const dash = await browser.tabs.query({ title: "Tab Manager" });
      if (dash.length === 0) {
        await browser.tabs.create({
          url: browser.runtime.getURL("/dashboard.html"),
          pinned: true,
          active: true,
        });
      }
    } catch (err) {
      console.error("Failed to open TabManagerDB:", err);
    }
  })();

  //
  // Tabs
  //
  refreshActiveTabs();

  browser.tabs.onCreated.addListener(async (tab) => {
    if (tab.index == null) return;

    const now = Date.now();
    const newRow: Tab = {
      ...tab,
      createdAt: now,
      updatedAt: now,
    };

    await db.transaction("rw", db.activeTabs, async () => {
      await shiftIndices(tab.windowId, tab.index, +1);
      await db.activeTabs.put(newRow);
    });
  });

  browser.tabs.onRemoved.addListener(async (tabId) => {
    const removed = await db.activeTabs.get(tabId);
    if (!removed) return;

    await db.transaction("rw", db.activeTabs, async () => {
      await shiftIndices(removed.windowId, removed.index + 1, -1);
      await db.activeTabs.delete(tabId);
    });
  });

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const now = Date.now();
    const dbTab = await db.activeTabs.get(tabId);
    if (!dbTab) return;

    const updated: Tab = {
      ...dbTab,
      ...tab, // grab everything tab has
      ...changeInfo, // overwrite with changeInfo if needed
      updatedAt: now,
    };

    await db.activeTabs.put(updated);
  });

  // Moving tabs across windows
  browser.tabs.onDetached.addListener(async (_tabId, detachInfo) => {
    const { oldWindowId, oldPosition } = detachInfo;
    await shiftIndices(oldWindowId, oldPosition + 1, -1);
  });

  browser.tabs.onAttached.addListener(async (tabId, attachInfo) => {
    const { newWindowId, newPosition } = attachInfo;
    const now = Date.now();

    await shiftIndices(newWindowId, newPosition, +1);

    const moved = await db.activeTabs.get(tabId);
    if (moved) {
      moved.windowId = newWindowId;
      moved.index = newPosition;
      moved.updatedAt = now;
      await db.activeTabs.put(moved);
    }
  });

  // Moving tabs
  browser.tabs.onMoved.addListener(async (tabId, moveInfo) => {
    const { windowId, fromIndex: from, toIndex: to } = moveInfo;
    if (from === to) return;

    db.transaction("rw", db.activeTabs, async () => {
      if (from < to) {
        // shift DOWN
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

      // moved tab itself
      const m = await db.activeTabs.get(tabId);
      if (m) {
        m.index = to;
        m.updatedAt = Date.now();
        await db.activeTabs.put(m);
      }
    });
  });

  browser.runtime.onMessage.addListener((message, _sender) => {
    if (message === "Refresh tabs") {
      console.log("Refreshing tabs ");
      reconcileTabs().catch((err) => {
        console.error("Reconciliation failed:", err);
      });
    }
  });
});
