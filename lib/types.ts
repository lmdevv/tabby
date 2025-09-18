import type { Browser } from "wxt/browser";

export interface Tab extends Browser.tabs.Tab {
  stableId: string;
  workspaceId: number;
  tabStatus: "active" | "archived";
  tags?: string[];
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TabGroup extends Browser.tabGroups.TabGroup {
  stableId: string;
  workspaceId: number;
  groupStatus: "active" | "archived";
  createdAt: number;
  updatedAt: number;
}

export interface Workspace {
  id: number;
  groupId?: number;
  name: string;
  description?: string;
  createdAt: number; // epoch ms
  lastOpened: number;
  active: 1 | 0;
  resourceGroupIds: number[]; // Ordered list of resource group IDs in this workspace
}

export interface WorkspaceGroup {
  id: number;
  name: string;
  icon?: string;
  collapsed: 1 | 0; // true or false
}

export type Resource = Pick<
  Browser.tabs.Tab,
  "url" | "title" | "favIconUrl"
> & {
  id: number;
  tags?: string[];
  description?: string;
  createdAt: number;
  updatedAt: number;
};

export interface ResourceGroup {
  id: number;
  name: string;
  collapsed: 1 | 0;
  resourceIds: string[]; // Ordered list of resource IDs in this group
  description?: string;
  createdAt: number;
  updatedAt: number;
}

// Message types for runtime communication
export interface OpenWorkspaceMessage {
  type: "openWorkspace";
  workspaceId: number;
  skipTabSwitching?: boolean;
}

export interface CloseWorkspaceMessage {
  type: "closeWorkspace";
}

export interface RefreshTabsMessage {
  type: "refreshTabs";
}

export type RuntimeMessage =
  | OpenWorkspaceMessage
  | CloseWorkspaceMessage
  | RefreshTabsMessage;
