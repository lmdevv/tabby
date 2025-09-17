import type { Browser } from "wxt/browser";

export interface Tab extends Browser.tabs.Tab {
  workspaceId?: number;
  tags?: string[];
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Workspace {
  id?: number;
  groupId: number;
  name: string;
  description?: string;
  createdAt: number; // epoch ms
  lastOpened: number;
  opened: number; // 1 true 0 false
}

export interface WorkspaceGroup {
  id: number;
  name: string;
  icon?: string;
  workspaces: Workspace[];
}

export interface Resource {
  id?: number;
  name: string;
  description?: string;
  createdAt: number;
  lastAccessed: number;
}
