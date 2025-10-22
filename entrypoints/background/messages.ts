import { browser } from "wxt/browser";
import {
  cleanDuplicateTabsInWorkspace,
  cleanNonResourceTabsInWorkspace,
  cleanResourceTabsInWorkspace,
  cleanUnusedTabsInWorkspace,
} from "@/entrypoints/background/operations/cleaning-operations";
import { reconcileTabs } from "@/entrypoints/background/operations/db-operations";
import { convertTabGroupToResource } from "@/entrypoints/background/operations/resource-operations";
import {
  groupTabsInWorkspace,
  sortTabsInWorkspace,
  ungroupTabsInWorkspace,
} from "@/entrypoints/background/operations/tab-operations";
import {
  activateWorkspace,
  createWorkspaceFromUrls,
} from "@/entrypoints/background/operations/workspace-operations";
import {
  createWorkspaceSnapshot,
  deleteSnapshot,
  restoreSnapshot,
} from "@/entrypoints/background/snapshots";
import {
  closeTabsSafely,
  getLastFocusedWindowIdSafe,
  isDashboardTab,
} from "@/entrypoints/background/utils";
import { db } from "@/lib/db/db";
import { getRandomTabGroupColor } from "@/lib/helpers/tab-helpers";
import type { RuntimeMessage, Workspace } from "@/lib/types/types";

type HandlerResult = { success: boolean; [key: string]: unknown };

type Ctx = { getActiveWorkspace: () => Workspace | undefined };

type HandlersMap = {
  [K in RuntimeMessage["type"]]: (
    message: Extract<RuntimeMessage, { type: K }>,
    ctx: Ctx,
  ) => Promise<HandlerResult>;
};

function uniqueValidUrls(urls: string[] | undefined): string[] {
  const out = new Set<string>();
  for (const u of urls ?? []) {
    if (!u) continue;
    try {
      const parsed = new URL(u);
      if (parsed.protocol && parsed.hostname) out.add(parsed.toString());
    } catch {
      // ignore invalid
    }
  }
  return Array.from(out);
}

const handlers: Partial<HandlersMap> = {
  async updateTabGroup(message) {
    await browser.tabGroups.update(message.groupId, {
      title: message.title,
      color: message.color as Browser.tabGroups.Color,
    });
    return { success: true };
  },

  async toggleGroupCollapse(message) {
    const group = await browser.tabGroups.get(message.groupId);
    await browser.tabGroups.update(message.groupId, {
      collapsed: !group.collapsed,
    });
    return { success: true };
  },

  async openWorkspace(message) {
    await activateWorkspace(message.workspaceId, {
      skipTabSwitching: message.skipTabSwitching === true,
    });
    return { success: true };
  },

  async closeWorkspace() {
    const currentActiveWorkspace = await db.workspaces
      .where("active")
      .equals(1)
      .first();
    if (currentActiveWorkspace) {
      await db.activeTabs
        .where("workspaceId")
        .equals(currentActiveWorkspace.id)
        .modify({ tabStatus: "archived" });

      await db.workspaces
        .where("id")
        .equals(currentActiveWorkspace.id)
        .modify({ active: 0 });

      const allTabs = await browser.tabs.query({});
      const toClose = allTabs
        .map((t) => (t.id != null && !isDashboardTab(t) ? t.id : undefined))
        .filter((id): id is number => id != null);
      await closeTabsSafely(toClose);
    }
    return { success: true };
  },

  async createSnapshot(message, ctx) {
    try {
      const ws = message.workspaceId ?? ctx.getActiveWorkspace()?.id;
      if (!ws) return { success: false, error: "No workspace" };
      const id = await createWorkspaceSnapshot(ws, message.reason ?? "manual");
      if (id <= 0) return { success: false, error: "Nothing to snapshot" };
      return { success: true, snapshotId: id } as const;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } satisfies HandlerResult;
    }
  },

  async restoreSnapshot(message) {
    try {
      const result = await restoreSnapshot(
        message.snapshotId,
        message.mode ?? "replace",
      );
      return {
        success: Boolean(result?.success),
        error: result?.error,
      } as const;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } satisfies HandlerResult;
    }
  },

  async deleteSnapshot(message) {
    try {
      await deleteSnapshot(message.snapshotId);
      return { success: true } as const;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } satisfies HandlerResult;
    }
  },

  async refreshTabs() {
    await reconcileTabs();
    return { success: true };
  },

  async sortTabs(message) {
    await sortTabsInWorkspace(message.workspaceId, message.sortType);
    return { success: true };
  },

  async groupTabs(message) {
    await groupTabsInWorkspace(message.workspaceId, message.groupType);
    return { success: true };
  },

  async ungroupTabs(message) {
    await ungroupTabsInWorkspace(message.workspaceId);
    return { success: true };
  },

  async moveTab(message) {
    await browser.tabs.move(message.tabId, { index: message.newIndex });
    return { success: true };
  },

  async cleanUnusedTabs(message) {
    await cleanUnusedTabsInWorkspace(
      message.workspaceId,
      message.daysThreshold,
    );
    return { success: true };
  },

  async cleanDuplicateTabs(message) {
    await cleanDuplicateTabsInWorkspace(message.workspaceId);
    return { success: true };
  },

  async cleanResourceTabs(message) {
    await cleanResourceTabsInWorkspace(message.workspaceId);
    return { success: true };
  },

  async cleanNonResourceTabs(message) {
    await cleanNonResourceTabsInWorkspace(message.workspaceId);
    return { success: true };
  },

  async convertTabGroupToResource(message) {
    await convertTabGroupToResource(message.groupId);
    return { success: true };
  },

  async openResourcesAsTabs(message) {
    const urls = uniqueValidUrls(message.urls);
    if (urls.length === 0) return { success: false };
    const windowId = await getLastFocusedWindowIdSafe();
    for (const url of urls) {
      await browser.tabs.create({ url, windowId, active: false });
    }
    return { success: true };
  },

  async openResourcesAsGroup(message) {
    const urls = uniqueValidUrls(message.urls);
    if (urls.length === 0) return { success: false };
    let targetWindowId = await getLastFocusedWindowIdSafe();
    const createdTabIds: number[] = [];
    for (const url of urls) {
      const tab = await browser.tabs.create({
        url,
        windowId: targetWindowId,
        active: false,
      });
      if (tab.id != null) {
        createdTabIds.push(tab.id);
        if (!targetWindowId && tab.windowId != null)
          targetWindowId = tab.windowId;
      }
    }
    if (createdTabIds.length >= 2 && targetWindowId != null) {
      const groupId = await browser.tabs.group({
        tabIds: createdTabIds as [number, ...number[]],
        createProperties: { windowId: targetWindowId },
      });
      await browser.tabGroups.update(groupId, {
        title: message.title,
        color: getRandomTabGroupColor(),
      });
    }
    return { success: true };
  },

  async createWorkspaceFromResources(message) {
    return await createWorkspaceFromUrls(message.name, message.urls);
  },

  async createWorkspaceFromTabGroup(message) {
    const tabGroup = await db.tabGroups.get(message.groupId);
    if (!tabGroup) return { success: false, error: "Tab group not found" };
    const tabsInGroup = await db.activeTabs
      .where("groupId")
      .equals(message.groupId)
      .toArray();
    const urls = tabsInGroup
      .map((t) => t.url)
      .filter((u): u is string => Boolean(u));
    const targetName = message.name || tabGroup.title || "New Workspace";
    const created = await createWorkspaceFromUrls(targetName, urls);
    if (!created.success || !created.workspaceId) return created;
    const tabIdsToClose = tabsInGroup
      .map((t) => t.id)
      .filter((id): id is number => id != null);
    await closeTabsSafely(tabIdsToClose);
    const stableIdsToArchive = tabsInGroup.map((t) => t.stableId);
    await db.transaction("rw", db.activeTabs, db.tabGroups, async () => {
      if (stableIdsToArchive.length > 0) {
        await db.activeTabs
          .where("stableId")
          .anyOf(stableIdsToArchive)
          .modify({ tabStatus: "archived" });
      }
      await db.tabGroups.update(message.groupId, {
        groupStatus: "archived",
        updatedAt: Date.now(),
      });
    });
    return { success: true, workspaceId: created.workspaceId };
  },
};

export function registerMessageHandlers(
  getActiveWorkspace: () => Workspace | undefined,
) {
  browser.runtime.onMessage.addListener(
    (message: RuntimeMessage, _sender, sendResponse) => {
      try {
        if (typeof message !== "object" || !message) return false;
        const handler = handlers[message.type] as
          | ((
              m: Extract<RuntimeMessage, { type: typeof message.type }>,
              ctx: Ctx,
            ) => Promise<HandlerResult>)
          | undefined;
        if (!handler) {
          sendResponse({
            success: false,
            error: "Unknown message type",
          } satisfies HandlerResult);
          return true;
        }
        (async () => {
          try {
            const res = await handler(
              message as Extract<RuntimeMessage, { type: typeof message.type }>,
              { getActiveWorkspace },
            );
            sendResponse(res as HandlerResult);
          } catch (error) {
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            } satisfies HandlerResult);
          }
        })();
        // Return true to indicate we'll respond asynchronously
        return true;
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } satisfies HandlerResult);
        return true;
      }
    },
  );
}
