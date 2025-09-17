import type {
  Resource,
  ResourceGroup,
  Tab,
  Workspace,
  WorkspaceGroup,
} from "@/lib/types";
import Dexie, { type EntityTable } from "dexie";

class TabManagerDB extends Dexie {
  workspaceGroups!: EntityTable<WorkspaceGroup, "id">;
  workspaces!: EntityTable<Workspace, "id">;
  activeTabs!: EntityTable<Tab, "id">;
  resourceGroups!: EntityTable<ResourceGroup, "id">;
  resources!: EntityTable<Resource, "id">;

  constructor() {
    super("TabManagerDB");

    this.version(1).stores({
      workspaceGroups: "++id, name, collapsed",
      workspaces:
        "++id, groupId, name, createdAt, lastOpened, active, resourceGroupIds",
      activeTabs:
        "++id, windowId, workspaceId, title, index, url, groupId, updatedAt, tabStatus, stableId",
      resourceGroups:
        "++id, name, collapsed, resourceIds, createdAt, updatedAt",
      resources: "++id, url, title, createdAt, updatedAt, stableId",
    });
  }
}

export const db = new TabManagerDB();
