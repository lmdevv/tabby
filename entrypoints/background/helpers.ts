import type { Tab } from "@/lib/types";
import { browser } from "wxt/browser";
import { db } from "./db";

export async function refreshActiveTabs() {
  const liveTabs = await browser.tabs.query({});
  await db.activeTabs.clear(); // wipe out any stale data

  const now = Date.now(); // stamp timestamps
  const toAdd = liveTabs.map((t) => ({
    ...t,
    createdAt: now,
    updatedAt: now,
  }));
  await db.activeTabs.bulkAdd(toAdd);
}

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

// NOTE: this is for debug only
export async function reconcileTabs() {
  const now = Date.now();

  // 1. fetch live tabs from Chrome
  const liveTabs = await browser.tabs.query({});
  // build a map by tabId for quick lookup
  const liveMap = new Map<number, Browser.tabs.Tab>();
  for (const tab of liveTabs) {
    if (tab.id != null) liveMap.set(tab.id, tab);
  }

  // 2. fetch stored tabs from IndexedDB
  const storedTabs = await db.activeTabs.toArray();
  const storedMap = new Map<number, Tab>();
  for (const tab of storedTabs) {
    if (tab.id != null) storedMap.set(tab.id, tab);
  }

  // 3. Detect additions & updates
  for (const [tabId, liveTab] of liveMap.entries()) {
    const stored = storedMap.get(tabId);
    if (!stored) {
      console.log(
        `🆕 [Tab ${tabId}] new tab added:`,
        liveTab.title,
        liveTab.url,
      );
      await db.activeTabs.put({
        ...liveTab,
        workspaceId: 1,
        createdAt: now,
        updatedAt: now,
      } as Tab);
    } else {
      // compare key fields and collect diffs
      const fieldsToCheck: (keyof Browser.tabs.Tab)[] = [
        "url",
        "title",
        "pinned",
        "index",
        "groupId",
        //"active",
        "windowId",
      ];
      // biome-ignore lint/suspicious/noExplicitAny: intentional use of any, all of this is going away on prod
      const diffs: Array<{ field: string; old: any; new: any }> = [];

      for (const field of fieldsToCheck) {
        // biome-ignore lint/suspicious/noExplicitAny: intentional use of any, all of this is going away on prod
        const oldVal = (stored as any)[field];
        // biome-ignore lint/suspicious/noExplicitAny: intentional use of any, all of this is going away on prod
        const newVal = (liveTab as any)[field];
        if (oldVal !== newVal) {
          diffs.push({ field, old: oldVal, new: newVal });
        }
      }

      if (diffs.length) {
        console.log(`✏ [Tab ${tabId} – “${liveTab.title}”] detected changes:`);
        for (const { field, old, new: newer } of diffs) {
          console.log(`   • ${field}:`, `"${old}"`, "→", `"${newer}"`);
        }
        await db.activeTabs.put({
          ...stored,
          ...liveTab,
          updatedAt: now,
        } as Tab);
      }
    }
  }

  // 4. Detect removals
  for (const [tabId] of storedMap.entries()) {
    if (!liveMap.has(tabId)) {
      console.log("found undeleted tab", tabId);
      await db.activeTabs.delete(tabId);
    }
  }
}
