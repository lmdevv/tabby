/**
 * Generic localStorage cache manager
 * Provides instant synchronous access during initial loads
 */
export class CacheManager<
  T = Record<string, string | boolean | number | number[]>,
> {
  private storageKey: string;

  constructor(storageKey: string) {
    this.storageKey = storageKey;
  }

  getCachedData(): T | null {
    try {
      const cached = localStorage.getItem(this.storageKey);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  setCachedData(data: T): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch {
      // Ignore localStorage errors
    }
  }

  getCachedItem<K extends keyof T>(key: K): T[K] | null {
    const cached = this.getCachedData();
    return cached?.[key] ?? null;
  }

  updateCachedItem<K extends keyof T>(key: K, value: T[K]): void {
    const current = this.getCachedData() || ({} as T);
    (current as Record<string, T[K]>)[key as string] = value;
    this.setCachedData(current);
  }

  getParsedCachedItem<K extends keyof T>(key: K, defaultValue: T[K]): T[K] {
    const cached = this.getCachedItem(key);
    if (cached === null) return defaultValue;

    // Parse boolean strings back to booleans
    if (typeof defaultValue === "boolean" && typeof cached === "string") {
      return (cached === "true") as T[K];
    }

    // Parse number strings back to numbers
    if (typeof defaultValue === "number" && typeof cached === "string") {
      return Number(cached) as T[K];
    }

    // Parse JSON strings back to arrays
    if (Array.isArray(defaultValue) && typeof cached === "string") {
      try {
        return JSON.parse(cached) as T[K];
      } catch {
        return defaultValue;
      }
    }

    return cached;
  }
}

/**
 * Specialized cache manager for state
 */
export class StateCacheManager extends CacheManager<
  Record<string, string | boolean | number | number[]>
> {
  constructor() {
    super("tabby_state_cache");
  }
}

// Singleton instance for state
export const stateCache = new StateCacheManager();

import type { Workspace, WorkspaceGroup } from "../types/types";

/**
 * Specialized cache manager for workspace breadcrumb data
 */
export interface CachedWorkspaceData {
  activeWorkspace?: Workspace;
  shownWorkspace?: Workspace;
  workspaceGroup?: WorkspaceGroup;
  shownWorkspaceId?: number;
}

export class WorkspaceCacheManager extends CacheManager<CachedWorkspaceData> {
  constructor() {
    super("tabby_workspace_cache");
  }
}

// Singleton instance for workspace data
export const workspaceCache = new WorkspaceCacheManager();

/**
 * Specialized cache manager for sidebar workspace data
 */
export interface CachedSidebarData {
  workspaceGroups?: WorkspaceGroup[];
  workspaces?: Workspace[];
  undefinedTabsCount?: number;
  activeWorkspace?: Workspace;
}

export class SidebarCacheManager extends CacheManager<CachedSidebarData> {
  constructor() {
    super("tabby_sidebar_cache");
  }
}

// Singleton instance for sidebar data
export const sidebarCache = new SidebarCacheManager();
