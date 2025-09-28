import type { Browser } from "wxt/browser";

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
  windowId: number;
  sortType: "title" | "domain" | "recency";
}

export interface GroupTabsMessage {
  type: "groupTabs";
  windowId: number;
  groupType: "domain";
}

export type RuntimeMessage =
  | OpenWorkspaceMessage
  | CloseWorkspaceMessage
  | RefreshTabsMessage
  | UpdateTabGroupMessage
  | CreateSnapshotMessage
  | RestoreSnapshotMessage
  | DeleteSnapshotMessage
  | SortTabsMessage
  | GroupTabsMessage;

//
// Built-in AI API types
//

export type LanguageModelAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface LanguageModelParams {
  defaultTopK: number;
  maxTopK: number;
  defaultTemperature: number;
  maxTemperature: number;
}

export interface LanguageModelMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
  removeEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
}

export interface DownloadProgressEvent {
  loaded: number; // Progress as a fraction (0.0 to 1.0)
}

export type PromptRole = "system" | "user" | "assistant";

export type PromptContentType = "text" | "image" | "audio";

export interface PromptTextContent {
  type: "text";
  value: string;
}

export interface PromptImageContent {
  type: "image";
  value:
    | Blob
    | ImageData
    | HTMLImageElement
    | HTMLCanvasElement
    | HTMLVideoElement;
}

export interface PromptAudioContent {
  type: "audio";
  value: Blob;
}

export type PromptContent =
  | PromptTextContent
  | PromptImageContent
  | PromptAudioContent;

export interface PromptMessage {
  role: PromptRole;
  content: string | PromptContent[];
  prefix?: boolean; // Only for assistant role to prefill response
}

export interface ExpectedInput {
  type: PromptContentType;
  languages?: string[]; // For text inputs
}

export interface LanguageModelCreateOptions {
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
  initialPrompts?: PromptMessage[];
  expectedInputs?: ExpectedInput[];
  monitor?: (monitor: LanguageModelMonitor) => void;
}

export interface PromptOptions {
  signal?: AbortSignal;
  responseConstraint?: any; // JSON Schema object
  omitResponseConstraintInput?: boolean;
}

export interface LanguageModelSession {
  prompt(
    input: string | PromptMessage[],
    options?: PromptOptions,
  ): Promise<string>;
  promptStreaming(
    input: string | PromptMessage[],
    options?: PromptOptions,
  ): ReadableStream<string>;
  append(messages: PromptMessage[]): Promise<void>;
  clone(options?: { signal?: AbortSignal }): Promise<LanguageModelSession>;
  destroy(): void;
  inputUsage: number;
  inputQuota: number;
  measureInputUsage(
    input: string | PromptMessage[],
    options?: PromptOptions,
  ): Promise<number>;
}

export interface LanguageModel {
  availability(): Promise<LanguageModelAvailability>;
  params(): Promise<LanguageModelParams>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}
