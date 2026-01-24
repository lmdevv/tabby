import { browser } from "wxt/browser";

/**
 * Helper function to get the domain from a URL
 */
export function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return "";
  }
}

/**
 * Helper function to reliably identify dashboard tabs
 */
export function isDashboardTab(tab: { url?: string }): boolean {
  if (!tab.url) return false;
  const ourExtensionBaseURL = browser.runtime.getURL("");
  const specificDashboardURL = browser.runtime.getURL("/dashboard.html");
  if (tab.url === specificDashboardURL) return true;
  if (tab.url.startsWith(ourExtensionBaseURL) && tab.url.includes("/dashboard"))
    return true;
  return false;
}

export async function getDashboardWindowId(): Promise<number | undefined> {
  const tabs = await browser.tabs.query({});
  for (const t of tabs) {
    if (t.windowId != null && isDashboardTab({ url: t.url })) return t.windowId;
  }
  return undefined;
}

export async function getLastFocusedWindowIdSafe(): Promise<
  number | undefined
> {
  try {
    const w = await browser.windows.getLastFocused();
    return w?.id ?? undefined;
  } catch {
    return undefined;
  }
}

export async function closeTabsSafely(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) return;
  try {
    const existing = await browser.tabs.query({});
    const existingIds = new Set(
      existing.map((t) => t.id).filter((id): id is number => id !== undefined),
    );
    const valid = tabIds.filter((id) => existingIds.has(id));
    if (valid.length > 0) await browser.tabs.remove(valid);
  } catch (e) {
    console.error("Error closing tabs safely:", e);
  }
}

export async function openUrlsInWindow(
  urls: string[],
  windowId?: number,
  opts?: { active?: boolean },
): Promise<number[]> {
  const createdIds: number[] = [];
  for (const url of urls) {
    const tab = await browser.tabs.create({
      url,
      windowId,
      active: opts?.active ?? false,
    });
    if (tab.id != null) {
      createdIds.push(tab.id);
      if (!windowId && tab.windowId != null) windowId = tab.windowId;
    }
  }
  return createdIds;
}

/**
 * Wraps an async operation with quota error handling.
 * If QuotaExceededError occurs, triggers cleanup and retries once.
 */
export async function withQuotaHandling<T>(
  operation: () => Promise<T>,
  cleanup?: () => Promise<void>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "QuotaExceededError" ||
        error.message.includes("QuotaExceededError"))
    ) {
      console.warn("⚠️ Storage quota exceeded, attempting cleanup...");

      // Run cleanup
      if (cleanup) {
        await cleanup();
      } else {
        // Default cleanup: purge old archived data
        const { purgeArchivedTabs, purgeArchivedTabGroups } = await import(
          "@/entrypoints/background/operations/cleaning-operations"
        );
        await purgeArchivedTabs(7); // More aggressive - 7 days
        await purgeArchivedTabGroups(7);
      }

      // Retry the operation once
      return await operation();
    }
    throw error;
  }
}
