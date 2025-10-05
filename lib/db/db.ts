import Dexie, { type EntityTable } from "dexie";
import type {
  Resource,
  ResourceGroup,
  SnapshotTab,
  SnapshotTabGroup,
  StateEntry,
  Tab,
  TabGroup,
  Workspace,
  WorkspaceGroup,
  WorkspaceSnapshot,
} from "@/lib/types/types";

class TabManagerDB extends Dexie {
  workspaceGroups!: EntityTable<WorkspaceGroup, "id">;
  workspaces!: EntityTable<Workspace, "id">;
  activeTabs!: EntityTable<Tab, "id">;
  tabGroups!: EntityTable<TabGroup, "id">;
  resourceGroups!: EntityTable<ResourceGroup, "id">;
  resources!: EntityTable<Resource, "id">;
  state!: EntityTable<StateEntry, "id">;
  // Snapshots
  workspaceSnapshots!: EntityTable<WorkspaceSnapshot, "id">;
  snapshotTabs!: EntityTable<SnapshotTab, "id">;
  snapshotTabGroups!: EntityTable<SnapshotTabGroup, "id">;

  constructor() {
    super("TabManagerDB");

    this.version(1).stores({
      workspaceGroups: "++id, name, collapsed",
      workspaces:
        "++id, groupId, name, createdAt, lastOpened, active, resourceGroupIds",
      activeTabs:
        "++id, windowId, workspaceId, title, index, url, groupId, updatedAt, tabStatus, stableId",
      tabGroups:
        "++id, windowId, workspaceId, title, color, collapsed, createdAt, updatedAt, stableId, groupStatus",
      resourceGroups:
        "++id, name, collapsed, resourceIds, createdAt, updatedAt",
      resources: "++id, url, title, favIconUrl, createdAt, updatedAt",
      state: "++id, key, createdAt, updatedAt",
      workspaceSnapshots: "++id, workspaceId, createdAt",
      snapshotTabs: "++id, snapshotId, windowIndex, groupStableId",
      snapshotTabGroups: "++id, snapshotId, stableId",
    });

    // Version 2: Add unique index on settings key for better performance and data integrity
    this.version(2).stores({
      state: "++id, &key, createdAt, updatedAt",
    });
  }
}

export const db = new TabManagerDB();
