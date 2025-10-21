// TODO:
// Improve the snapshot logic:
// It should not just take based on time, but based on tabs moved around, bc if tabs didnt move at all for 10 minutes, maybe that new snpshot is unnecessary
// Also, the deletion logic would make more sense if the timestamp of the last snapshot should be only one week from now, so the rest can go
// Maybe add notes and titles to snapshots
// Diff-based snapshot restoration
import { browser } from "wxt/browser";
import { isDashboardTab } from "@/entrypoints/background/utils";
import { db } from "@/lib/db/db";
import type {
  SnapshotTab,
  SnapshotTabGroup,
  Workspace,
  WorkspaceSnapshot,
} from "@/lib/types/types";

const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const SNAPSHOT_RETENTION = 50; // per workspace

export async function createWorkspaceSnapshot(
  workspaceId: number,
  reason: WorkspaceSnapshot["reason"] = "interval",
): Promise<number> {
  const now = Date.now();
  // Guard: only real workspaces
  if (workspaceId <= 0) return -1;

  // Gather current state from DB (active tabs/groups for workspace)
  const tabs = await db.activeTabs
    .where("workspaceId")
    .equals(workspaceId)
    .and((t) => t.tabStatus === "active")
    .toArray();

  const filteredTabs = tabs.filter((t) => {
    // Exclude dashboard/extension tabs
    return !isDashboardTab({
      url: t.url ?? undefined,
    });
  });
  if (filteredTabs.length === 0) return -1; // nothing to snapshot

  const groups = await db.tabGroups
    .where("workspaceId")
    .equals(workspaceId)
    .and((g) => g.groupStatus === "active")
    .toArray();

  // Compute windowIndex mapping (stable within snapshot)
  const uniqueWindowIds = Array.from(
    new Set(filteredTabs.map((t) => t.windowId)),
  ).sort((a, b) => a - b);
  const windowIndexMap = new Map<number, number>();
  for (let idx = 0; idx < uniqueWindowIds.length; idx++) {
    const id = uniqueWindowIds[idx];
    if (typeof id === "number") {
      windowIndexMap.set(id, idx);
    }
  }

  // Prepare snapshot header (insert first to get snapshotId)
  const snapshotId = await db.workspaceSnapshots.add({
    workspaceId,
    createdAt: now,
    reason,
  } as WorkspaceSnapshot);

  // Build rows
  const snapshotGroups = groups.map(
    (g) =>
      ({
        snapshotId,
        stableId: g.stableId,
        title: g.title,
        color: g.color,
        collapsed: g.collapsed,
        windowIndex: windowIndexMap.get(g.windowId) ?? 0,
        createdAt: now,
      }) satisfies Omit<SnapshotTabGroup, "id">,
  );

  const groupIdToStable = new Map<number, string>();
  groups.forEach((g) => {
    if (g.id != null) groupIdToStable.set(g.id, g.stableId);
  });

  const snapshotTabRows = filteredTabs.map(
    (t) =>
      ({
        snapshotId,
        url: t.url,
        title: t.title,
        favIconUrl: t.favIconUrl,
        pinned: t.pinned,
        index: t.index,
        description: t.description,
        tags: t.tags,
        windowIndex: windowIndexMap.get(t.windowId) ?? 0,
        groupStableId:
          t.groupId && t.groupId !== -1
            ? groupIdToStable.get(t.groupId)
            : undefined,
      }) satisfies Omit<SnapshotTab, "id">,
  );

  await db.transaction(
    "rw",
    db.snapshotTabGroups,
    db.snapshotTabs,
    async () => {
      if (snapshotGroups.length)
        await db.snapshotTabGroups.bulkAdd(snapshotGroups);
      if (snapshotTabRows.length)
        await db.snapshotTabs.bulkAdd(snapshotTabRows);
    },
  );

  await pruneOldSnapshots(workspaceId);
  return snapshotId;
}

export async function pruneOldSnapshots(workspaceId: number): Promise<void> {
  const all = await db.workspaceSnapshots
    .where("workspaceId")
    .equals(workspaceId)
    .reverse()
    .sortBy("createdAt");
  if (all.length <= SNAPSHOT_RETENTION) return;
  const toDelete = all.slice(SNAPSHOT_RETENTION);
  const ids = toDelete.map((s) => s.id);
  await db.transaction(
    "rw",
    db.workspaceSnapshots,
    db.snapshotTabs,
    db.snapshotTabGroups,
    async () => {
      await db.workspaceSnapshots.bulkDelete(ids);
      await db.snapshotTabs.where("snapshotId").anyOf(ids).delete();
      await db.snapshotTabGroups.where("snapshotId").anyOf(ids).delete();
    },
  );
}

export function startSnapshotScheduler(
  getActiveWorkspace: () => Workspace | undefined,
): void {
  setInterval(async () => {
    try {
      const aw = getActiveWorkspace();
      if (!aw) return;
      // lightweight gate: ensure at least 1 active non-dashboard tab
      const count = await db.activeTabs
        .where("workspaceId")
        .equals(aw.id)
        .and(
          (t) =>
            t.tabStatus === "active" &&
            !t.url?.startsWith(browser.runtime.getURL("")),
        )
        .count();
      if (count === 0) return;

      // Ensure min spacing between snapshots using last snapshot time
      const last = await db.workspaceSnapshots
        .where("workspaceId")
        .equals(aw.id)
        .reverse()
        .sortBy("createdAt");
      const lastTime = last[0]?.createdAt ?? 0;
      if (Date.now() - lastTime < SNAPSHOT_INTERVAL_MS) return;

      await createWorkspaceSnapshot(aw.id, "interval");
    } catch (e) {
      console.error("Snapshot scheduler error", e);
    }
  }, 60 * 1000); // check every minute
}

export async function restoreSnapshot(
  snapshotId: number,
  mode: "replace" | "append" = "append",
): Promise<{ success: boolean; error?: string }> {
  const header = await db.workspaceSnapshots.get(snapshotId);
  if (!header) return { success: false, error: "Snapshot not found" };

  const activeWs = await db.workspaces.where("active").equals(1).first();
  if (!activeWs || activeWs.id !== header.workspaceId) {
    return {
      success: false,
      error: "Active workspace does not match snapshot",
    };
  }

  const [tabs, groups] = await Promise.all([
    db.snapshotTabs.where("snapshotId").equals(snapshotId).toArray(),
    db.snapshotTabGroups.where("snapshotId").equals(snapshotId).toArray(),
  ]);

  // Build window buckets by windowIndex
  const byWindow = new Map<number, SnapshotTab[]>();
  for (const t of tabs) {
    if (!byWindow.has(t.windowIndex)) byWindow.set(t.windowIndex, []);
    byWindow.get(t.windowIndex)?.push(t);
  }
  for (const arr of byWindow.values())
    arr.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  // Close existing (non-dashboard) tabs if replacing
  if (mode === "replace") {
    const allCurrent = await browser.tabs.query({});
    const toClose: number[] = [];
    for (const t of allCurrent) {
      if (t.id != null) {
        const isDash = isDashboardTab(t);
        if (!isDash) toClose.push(t.id);
      }
    }
    if (toClose.length) await browser.tabs.remove(toClose);
  }

  const groupStableToNewTabIds = new Map<string, number[]>();

  if (mode === "append") {
    // Minimal append: open all links in the last-focused window, no grouping
    const focusedWindow = await browser.windows.getLastFocused();
    const targetWindowId = focusedWindow?.id;
    const allTabsSorted = tabs
      .slice()
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const tab of allTabsSorted) {
      if (!tab.url) continue;
      await browser.tabs.create({
        windowId: targetWindowId,
        url: tab.url,
        pinned: tab.pinned,
        active: false,
      });
    }
  } else {
    // Replace mode: recreate windows roughly by snapshot windowIndex and restore groups
    // Reuse dashboard window for windowIndex 0 if available
    const allCurrent = await browser.tabs.query({});
    let dashboardWindowId: number | undefined;
    for (const t of allCurrent) {
      if (isDashboardTab(t) && t.windowId != null) {
        dashboardWindowId = t.windowId;
        break;
      }
    }

    const sortedWindowIndexes = Array.from(byWindow.keys()).sort(
      (a, b) => a - b,
    );
    for (let i = 0; i < sortedWindowIndexes.length; i++) {
      const wIdx = sortedWindowIndexes[i];
      const targetWindowId =
        i === 0 && dashboardWindowId != null
          ? dashboardWindowId
          : ((await browser.windows.create({ focused: i === 0 }))?.id ??
            undefined);
      if (targetWindowId == null) {
        console.error(
          "Failed to resolve target window to create tabs for snapshot restore",
        );
        continue;
      }

      for (const tab of byWindow.get(wIdx) ?? []) {
        if (!tab.url) continue;
        const newTab = await browser.tabs.create({
          windowId: targetWindowId,
          url: tab.url,
          pinned: tab.pinned,
          active: false,
        });
        if (tab.groupStableId && newTab.id != null) {
          const arr = groupStableToNewTabIds.get(tab.groupStableId) ?? [];
          arr.push(newTab.id);
          groupStableToNewTabIds.set(tab.groupStableId, arr);
        }
      }
    }

    // Re-create groups only in replace mode
    for (const g of groups) {
      const ids = groupStableToNewTabIds.get(g.stableId) ?? [];
      if (ids.length === 0) continue;
      const newGroupId = await browser.tabs.group({
        tabIds: ids as [number, ...number[]],
      });
      await browser.tabGroups.update(newGroupId, {
        title: g.title,
        color: g.color as Browser.tabGroups.TabGroup["color"],
        collapsed: g.collapsed,
      });
    }
  }

  return { success: true };
}

export async function deleteSnapshot(snapshotId: number): Promise<void> {
  await db.transaction(
    "rw",
    db.workspaceSnapshots,
    db.snapshotTabs,
    db.snapshotTabGroups,
    async () => {
      await db.snapshotTabs.where("snapshotId").equals(snapshotId).delete();
      await db.snapshotTabGroups
        .where("snapshotId")
        .equals(snapshotId)
        .delete();
      await db.workspaceSnapshots.where("id").equals(snapshotId).delete();
    },
  );
}
