import { toast } from "sonner";
import type { Tab } from "@/lib/types/types";

/**
 * Copies a single tab's URL to clipboard
 */
export async function copySingleTabLink(tab: Tab): Promise<void> {
  if (!tab.url) return;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(tab.url);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = tab.url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    toast.success("Link copied to clipboard");
  } catch (error) {
    console.error("Failed to copy link:", error);
    toast.error("Failed to copy link");
  }
}

/**
 * Copies multiple tabs' URLs to clipboard, one per line
 */
export async function copyMultipleTabLinks(tabs: Tab[]): Promise<void> {
  if (!tabs.length) return;

  try {
    const links = tabs
      .map((tab) => tab.url)
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard.writeText(links);
    toast.success(`Link${tabs.length > 1 ? "s" : ""} copied to clipboard`);
  } catch (error) {
    console.error("Failed to copy links:", error);
    toast.error("Failed to copy links");
  }
}
