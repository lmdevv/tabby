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
export function isDashboardTab(tab: { url?: string; title?: string }): boolean {
  if (!tab.url) {
    return false;
  }

  const ourExtensionBaseURL = browser.runtime.getURL("");
  const specificDashboardURL = browser.runtime.getURL("/dashboard.html");

  if (tab.url === specificDashboardURL) {
    return true;
  }

  if (tab.url.startsWith(ourExtensionBaseURL)) {
    if (
      tab.url.includes("/dashboard") ||
      tab.title?.toLowerCase().includes("tab manager")
    ) {
      return true;
    }
  }
  return false;
}
