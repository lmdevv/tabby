import type { Resource, Tab, Workspace, WorkspaceGroup } from "@/lib/types";
import Dexie, { type EntityTable } from "dexie";

class TabManagerDB extends Dexie {
  workspaceGroups!: EntityTable<WorkspaceGroup, "id">;
  workspaces!: EntityTable<Workspace, "id">;
  activeTabs!: EntityTable<Tab, "id">;
  resources!: EntityTable<Resource, "id">;

  constructor() {
    super("TabManagerDB");

    this.version(1).stores({
      workspaceGroups: "++id, name",
      workspaces: "++id, groupId, name, createdAt, lastOpened, opened",
      activeTabs:
        "++id, windowId, workspaceId, title, index, url, groupId, updatedAt",
      resources: "++id, name, createdAt, lastAccessed",
    });
  }
}

export const db = new TabManagerDB();
