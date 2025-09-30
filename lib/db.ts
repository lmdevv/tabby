import Dexie, { type EntityTable } from "dexie";
import type {
  AppSettings,
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
  settings!: EntityTable<AppSettings, "id">;
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
      settings: "++id, key, createdAt, updatedAt",
      workspaceSnapshots: "++id, workspaceId, createdAt",
      snapshotTabs: "++id, snapshotId, windowIndex, groupStableId",
      snapshotTabGroups: "++id, snapshotId, stableId",
    });
  }
}

export const db = new TabManagerDB();
