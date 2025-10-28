import { browser } from "wxt/browser";
import { isDashboardTab } from "@/entrypoints/background/utils";
import { db } from "@/lib/db/db";
import { getDefaultValue } from "@/lib/state/state-defs";
import type {
  SnapshotTab,
  SnapshotTabGroup,
  Workspace,
  WorkspaceSnapshot,
} from "@/lib/types/types";

const SNAPSHOT_RETENTION = 50; // per workspace
const SNAPSHOT_MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes minimum between snapshots

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
        favIconUrl: t.favIconUrl,
        pinned: t.pinned,
        index: t.index,
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

export async function pruneActiveWorkspaceByAge(
  workspaceId: number,
): Promise<void> {
  // Get retention setting (default to 7 days)
  const retentionSetting = await db.state
    .where("key")
    .equals("snapshot:retentionDays")
    .first();
  const defaultValue = getDefaultValue("snapshot:retentionDays");
  const retentionDays = retentionSetting
    ? Number(retentionSetting.value)
    : defaultValue;

  // If unlimited (0), don't prune
  if (retentionDays === 0) return;

  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  // Get snapshots older than cutoff
  const oldSnapshots = await db.workspaceSnapshots
    .where("workspaceId")
    .equals(workspaceId)
    .and((s) => s.createdAt < cutoffTime)
    .toArray();

  if (oldSnapshots.length === 0) return;

  const ids = oldSnapshots.map((s) => s.id);

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

// Simple database-based change detection using most recent tab/group update
async function hasWorkspaceChangedSinceLastSnapshot(
  workspaceId: number,
): Promise<boolean> {
  // Get the most recent tab update timestamp for this workspace
  const mostRecentTabUpdate = await db.activeTabs
    .where("workspaceId")
    .equals(workspaceId)
    .and((t) => t.tabStatus === "active")
    .sortBy("updatedAt");

  // Get the most recent group update timestamp for this workspace
  const mostRecentGroupUpdate = await db.tabGroups
    .where("workspaceId")
    .equals(workspaceId)
    .and((g) => g.groupStatus === "active")
    .sortBy("updatedAt");

  // Find the most recent change timestamp
  const latestTabUpdate =
    mostRecentTabUpdate[mostRecentTabUpdate.length - 1]?.updatedAt ?? 0;
  const latestGroupUpdate =
    mostRecentGroupUpdate[mostRecentGroupUpdate.length - 1]?.updatedAt ?? 0;
  const latestChange = Math.max(latestTabUpdate, latestGroupUpdate);

  // Get the last snapshot timestamp
  const lastSnapshot = await db.workspaceSnapshots
    .where("workspaceId")
    .equals(workspaceId)
    .reverse()
    .sortBy("createdAt");

  const lastSnapshotAt = lastSnapshot[0]?.createdAt ?? 0;

  // If there have been changes since the last snapshot, return true
  return latestChange > lastSnapshotAt;
}

// State keys for snapshot tracking
const kLastSnapshotAt = (wsId: number) => `snapshot:lastAt:${wsId}`;

export async function maybeCreateSnapshot(workspace: Workspace): Promise<void> {
  if (workspace.id <= 0) return;

  // Check if there are any active non-dashboard tabs
  const count = await db.activeTabs
    .where("workspaceId")
    .equals(workspace.id)
    .and(
      (t) =>
        t.tabStatus === "active" &&
        !t.url?.startsWith(browser.runtime.getURL("")),
    )
    .count();
  if (count === 0) return;

  const now = Date.now();

  // Get the last snapshot timestamp
  const lastSnapshot = await db.workspaceSnapshots
    .where("workspaceId")
    .equals(workspace.id)
    .reverse()
    .sortBy("createdAt");

  const lastSnapshotAt = lastSnapshot[0]?.createdAt ?? 0;

  // Check if minimum time has passed
  const timeElapsed = now - lastSnapshotAt;
  if (timeElapsed < SNAPSHOT_MIN_INTERVAL_MS) return;

  // Check if workspace has changed since last snapshot
  const hasChanged = await hasWorkspaceChangedSinceLastSnapshot(workspace.id);

  if (hasChanged) {
    // Create snapshot
    const snapshotId = await createWorkspaceSnapshot(workspace.id, "interval");
    if (snapshotId > 0) {
      // Update last snapshot time (upsert by key to satisfy unique constraint)
      await db.transaction("rw", db.state, async () => {
        await db.state
          .where("key")
          .equals(kLastSnapshotAt(workspace.id))
          .modify({
            value: now,
            updatedAt: now,
          });

        // If no rows were modified, it means the state doesn't exist, so add it
        const existingCount = await db.state
          .where("key")
          .equals(kLastSnapshotAt(workspace.id))
          .count();
        if (existingCount === 0) {
          await db.state.add({
            key: kLastSnapshotAt(workspace.id),
            value: now,
            createdAt: now,
            updatedAt: now,
          });
        }
      });
    }
  }
}

export function initSnapshotScheduler(
  getActiveWorkspace: () => Workspace | undefined,
): void {
  // Clear any existing alarm
  browser.alarms.clear("snapshotCheck").catch(() => {});

  // Create alarm that fires every 5 minutes
  browser.alarms.create("snapshotCheck", {
    periodInMinutes: 5,
  });

  // Listen for alarm and potentially create snapshot + prune
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== "snapshotCheck") return;

    try {
      const activeWorkspace = getActiveWorkspace();
      if (!activeWorkspace) return;

      // Try to create snapshot if needed
      await maybeCreateSnapshot(activeWorkspace);

      // Prune old snapshots
      await pruneActiveWorkspaceByAge(activeWorkspace.id);
    } catch (e) {
      console.error("Snapshot scheduler error", e);
    }
  });
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
        color: g.color as Browser.tabGroups.TabGroup["color"],
        collapsed: g.collapsed,
      });
    }
  }

  return { success: true } as const;
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
