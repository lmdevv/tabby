import Dexie, { type EntityTable } from "dexie";
import type {
  Resource,
  ResourceGroup,
  Tab,
  TabGroup,
  Workspace,
  WorkspaceGroup,
} from "@/lib/types";

class TabManagerDB extends Dexie {
  workspaceGroups!: EntityTable<WorkspaceGroup, "id">;
  workspaces!: EntityTable<Workspace, "id">;
  activeTabs!: EntityTable<Tab, "id">;
  tabGroups!: EntityTable<TabGroup, "id">;
  resourceGroups!: EntityTable<ResourceGroup, "id">;
  resources!: EntityTable<Resource, "id">;

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
  }
}

export const db = new TabManagerDB();
