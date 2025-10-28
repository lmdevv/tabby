import type { Browser } from "wxt/browser";
import type {
  DownloadProgressEvent,
  ExpectedInput,
  LanguageModel,
  LanguageModelAvailability,
  LanguageModelCreateOptions,
  LanguageModelMonitor,
  LanguageModelParams,
  LanguageModelSession,
  PromptAudioContent,
  PromptContent,
  PromptContentType,
  PromptImageContent,
  PromptMessage,
  PromptOptions,
  PromptRole,
  PromptTextContent,
} from "./ai-types";

//
// Database types
//
export interface Tab extends Browser.tabs.Tab {
  stableId: string;
  workspaceId: number;
  tabStatus: "active" | "archived";
  tags?: string[];
  description?: string;
  createdAt: number;
  updatedAt: number;
  lastAccessed?: number;
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
  Tab,
  "url" | "title" | "favIconUrl" | "tags" | "description"
> & {
  id: number;
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

// Snapshot types
export interface WorkspaceSnapshot {
  id: number;
  workspaceId: number;
  createdAt: number; // epoch ms
  reason: "interval" | "manual" | "event";
}

export interface SnapshotTab {
  id: number;
  snapshotId: number;
  url?: string;
  title?: string;
  favIconUrl?: string;
  pinned?: boolean;
  index?: number;
  description?: string;
  tags?: string[];
  windowIndex: number; // stable within the snapshot
  groupStableId?: string; // reference to SnapshotTabGroup.stableId
}

export interface SnapshotTabGroup {
  id: number;
  snapshotId: number;
  stableId: string; // copied from TabGroup.stableId at snapshot time
  title?: string;
  color?: Browser.tabGroups.Color | string;
  collapsed?: boolean;
  windowIndex: number;
  createdAt: number;
}

//
// Message types
//

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

export interface UpdateTabGroupMessage {
  type: "updateTabGroup";
  groupId: number;
  title: string;
  color: string;
}

export interface ToggleGroupCollapseMessage {
  type: "toggleGroupCollapse";
  groupId: number;
}

export interface CollapseAllGroupsMessage {
  type: "collapseAllGroups";
  workspaceId: number;
}

export interface UncollapseAllGroupsMessage {
  type: "uncollapseAllGroups";
  workspaceId: number;
}

export interface CreateSnapshotMessage {
  type: "createSnapshot";
  workspaceId?: number;
  reason?: WorkspaceSnapshot["reason"];
}

export interface RestoreSnapshotMessage {
  type: "restoreSnapshot";
  snapshotId: number;
  mode?: "replace" | "append";
}

export interface DeleteSnapshotMessage {
  type: "deleteSnapshot";
  snapshotId: number;
}

export interface SortTabsMessage {
  type: "sortTabs";
  workspaceId: number;
  sortType: "title" | "domain" | "recency";
}

export interface GroupTabsMessage {
  type: "groupTabs";
  workspaceId: number;
  groupType: "domain";
}
export interface UngroupTabsMessage {
  type: "ungroupTabs";
  workspaceId: number;
}
export interface MoveTabMessage {
  type: "moveTab";
  tabId: number;
  newIndex: number;
}

export interface CleanUnusedTabsMessage {
  type: "cleanUnusedTabs";
  workspaceId: number;
  daysThreshold?: number;
}

export interface CleanDuplicateTabsMessage {
  type: "cleanDuplicateTabs";
  workspaceId: number;
}

export interface CleanResourceTabsMessage {
  type: "cleanResourceTabs";
  workspaceId: number;
}

export interface CleanNonResourceTabsMessage {
  type: "cleanNonResourceTabs";
  workspaceId: number;
}

export interface CleanAllTabsMessage {
  type: "cleanAllTabs";
  workspaceId: number;
}

export interface CloseTabsByIdsMessage {
  type: "closeTabsByIds";
  workspaceId: number;
  tabIds: number[];
}

export interface ConvertTabGroupToResourceMessage {
  type: "convertTabGroupToResource";
  groupId: number;
  deleteOriginal?: boolean;
}

// Resource group actions
export interface OpenResourcesAsTabsMessage {
  type: "openResourcesAsTabs";
  urls: string[];
}

export interface OpenResourcesAsGroupMessage {
  type: "openResourcesAsGroup";
  title: string;
  urls: string[];
}

export interface CreateWorkspaceFromResourcesMessage {
  type: "createWorkspaceFromResources";
  name: string;
  urls: string[];
}

export interface CreateWorkspaceFromTabGroupMessage {
  type: "createWorkspaceFromTabGroup";
  groupId: number;
  name?: string;
  deleteOriginal?: boolean;
}

export type RuntimeMessage =
  | OpenWorkspaceMessage
  | CloseWorkspaceMessage
  | RefreshTabsMessage
  | UpdateTabGroupMessage
  | ToggleGroupCollapseMessage
  | CollapseAllGroupsMessage
  | UncollapseAllGroupsMessage
  | CreateSnapshotMessage
  | RestoreSnapshotMessage
  | DeleteSnapshotMessage
  | SortTabsMessage
  | GroupTabsMessage
  | UngroupTabsMessage
  | MoveTabMessage
  | CleanUnusedTabsMessage
  | CleanDuplicateTabsMessage
  | CleanResourceTabsMessage
  | CleanNonResourceTabsMessage
  | CleanAllTabsMessage
  | CloseTabsByIdsMessage
  | ConvertTabGroupToResourceMessage
  | OpenResourcesAsTabsMessage
  | OpenResourcesAsGroupMessage
  | CreateWorkspaceFromResourcesMessage
  | CreateWorkspaceFromTabGroupMessage;

export type {
  LanguageModelAvailability,
  LanguageModelParams,
  LanguageModelMonitor,
  DownloadProgressEvent,
  PromptRole,
  PromptContentType,
  PromptTextContent,
  PromptImageContent,
  PromptAudioContent,
  PromptContent,
  PromptMessage,
  ExpectedInput,
  LanguageModelCreateOptions,
  PromptOptions,
  LanguageModelSession,
  LanguageModel,
};

// Application state entry type
export interface StateEntry {
  id: number;
  key: string;
  value: string | boolean | number;
  createdAt: number;
  updatedAt: number;
}

export type Theme = "light" | "dark" | "system";
