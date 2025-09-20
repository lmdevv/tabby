import Dexie, { type EntityTable } from "dexie";
import type {
  Resource,
  ResourceGroup,
  SnapshotTab,
  SnapshotTabGroup,
  Tab,
  TabGroup,
  Workspace,
  WorkspaceGroup,
  WorkspaceSnapshot,
} from "@/lib/types";

class TabManagerDB extends Dexie {
  workspaceGroups!: EntityTable<WorkspaceGroup, "id">;
  workspaces!: EntityTable<Workspace, "id">;
  activeTabs!: EntityTable<Tab, "id">;
  tabGroups!: EntityTable<TabGroup, "id">;
  resourceGroups!: EntityTable<ResourceGroup, "id">;
  resources!: EntityTable<Resource, "id">;
  // Snapshots
  workspaceSnapshots!: EntityTable<WorkspaceSnapshot, "id">;
  snapshotTabs!: EntityTable<SnapshotTab, "id">;
  snapshotTabGroups!: EntityTable<SnapshotTabGroup, "id">;

  constructor() {
    super("TabManagerDB");

    this.version(2)
      .stores({
        workspaceGroups: "++id, name, collapsed",
        workspaces:
          "++id, groupId, name, createdAt, lastOpened, active, resourceGroupIds",
        activeTabs:
          "++id, windowId, workspaceId, title, index, url, groupId, updatedAt, tabStatus, stableId",
        tabGroups:
          "++id, windowId, workspaceId, title, color, collapsed, createdAt, updatedAt, stableId, groupStatus",
        resourceGroups:
          "++id, name, collapsed, resourceIds, createdAt, updatedAt",
        resources: "++id, url, title, createdAt, updatedAt, stableId",
      })
      .upgrade(async (tx) => {
        // Migration: Set default groupStatus for existing tab groups
        await tx
          .table("tabGroups")
          .toCollection()
          .modify((group) => {
            if (!group.groupStatus) {
              group.groupStatus = "active";
            }
          });
      });

    // v3: add snapshot tables
    this.version(3)
      .stores({
        workspaceGroups: "++id, name, collapsed",
        workspaces:
          "++id, groupId, name, createdAt, lastOpened, active, resourceGroupIds",
        activeTabs:
          "++id, windowId, workspaceId, title, index, url, groupId, updatedAt, tabStatus, stableId",
        tabGroups:
          "++id, windowId, workspaceId, title, color, collapsed, createdAt, updatedAt, stableId, groupStatus",
        resourceGroups:
          "++id, name, collapsed, resourceIds, createdAt, updatedAt",
        resources: "++id, url, title, createdAt, updatedAt, stableId",
        // NEW snapshot tables
        workspaceSnapshots: "++id, workspaceId, createdAt",
        snapshotTabs: "++id, snapshotId, windowIndex, groupStableId",
        snapshotTabGroups: "++id, snapshotId, stableId",
      })
      .upgrade(async (tx) => {
        // v3 additive: ensure groupStatus exists (idempotent)
        await tx
          .table("tabGroups")
          .toCollection()
          .modify((group) => {
            if (!group.groupStatus) {
              group.groupStatus = "active";
            }
          });
      });

    // v4: normalize snapshot schema (remove deprecated count fields)
    this.version(4)
      .stores({
        workspaceGroups: "++id, name, collapsed",
        workspaces:
          "++id, groupId, name, createdAt, lastOpened, active, resourceGroupIds",
        activeTabs:
          "++id, windowId, workspaceId, title, index, url, groupId, updatedAt, tabStatus, stableId",
        tabGroups:
          "++id, windowId, workspaceId, title, color, collapsed, createdAt, updatedAt, stableId, groupStatus",
        resourceGroups:
          "++id, name, collapsed, resourceIds, createdAt, updatedAt",
        resources: "++id, url, title, createdAt, updatedAt, stableId",
        workspaceSnapshots: "++id, workspaceId, createdAt",
        snapshotTabs: "++id, snapshotId, windowIndex, groupStableId",
        snapshotTabGroups: "++id, snapshotId, stableId",
      })
      .upgrade(async (tx) => {
        // Remove old count fields if they exist on any snapshot rows
        await tx
          .table("workspaceSnapshots")
          .toCollection()
          .modify((s: unknown) => {
            const snap = s as Record<string, unknown>;
            if ("tabCount" in snap)
              delete (snap as { tabCount?: unknown }).tabCount;
            if ("windowCount" in snap)
              delete (snap as { windowCount?: unknown }).windowCount;
            if ("groupCount" in snap)
              delete (snap as { groupCount?: unknown }).groupCount;
          });
      });
  }
}

export const db = new TabManagerDB();
