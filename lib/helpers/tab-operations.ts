import { toast } from "sonner";
import { browser } from "wxt/browser";
import { aiGroupTabsInWorkspace } from "@/lib/ai/ai-grouping";

export type SortType = "title" | "domain" | "recency";

export interface TabOperationsOptions {
  workspaceId: number | null;
  onClose?: () => void;
}

export async function sortTabs(
  sortType: SortType,
  options: TabOperationsOptions,
): Promise<void> {
  try {
    await browser.runtime.sendMessage({
      type: "sortTabs",
      workspaceId: options.workspaceId,
      sortType,
    } as const);
    toast.success("Tabs sorted successfully");
    options.onClose?.();
  } catch (error) {
    console.error("Failed to sort tabs:", error);
    toast.error("Failed to sort tabs");
  }
}

export async function groupTabs(options: TabOperationsOptions): Promise<void> {
  try {
    await browser.runtime.sendMessage({
      type: "groupTabs",
      workspaceId: options.workspaceId,
      groupType: "domain",
    } as const);
    toast.success("Tabs grouped successfully");
    options.onClose?.();
  } catch (error) {
    console.error("Failed to group tabs:", error);
    toast.error("Failed to group tabs");
  }
}

export async function aiGroupTabs(
  options: TabOperationsOptions,
): Promise<void> {
  if (!options.workspaceId) {
    toast.error("No workspace selected");
    return;
  }

  try {
    toast.loading("Grouping tabs with AI...", { id: "ai-grouping" });
    await aiGroupTabsInWorkspace(options.workspaceId);
    toast.success("Tabs grouped with AI successfully", { id: "ai-grouping" });
    options.onClose?.();
  } catch (error) {
    console.error("Failed to AI group tabs:", error);
    toast.error("Failed to AI group tabs", { id: "ai-grouping" });
  }
}

export async function ungroupTabs(
  options: TabOperationsOptions,
): Promise<void> {
  try {
    await browser.runtime.sendMessage({
      type: "ungroupTabs",
      workspaceId: options.workspaceId,
    } as const);
    toast.success("Tabs ungrouped successfully");
    options.onClose?.();
  } catch (error) {
    console.error("Failed to ungroup tabs:", error);
    toast.error("Failed to ungroup tabs");
  }
}

export async function refreshTabs(
  options: TabOperationsOptions,
): Promise<void> {
  try {
    await browser.runtime.sendMessage({ type: "refreshTabs" });
    toast.success("Tabs refreshed successfully");
    options.onClose?.();
  } catch (error) {
    console.error("Failed to refresh tabs:", error);
    toast.error("Failed to refresh tabs");
  }
}

export async function openWorkspace(
  workspaceId: number,
  onClose?: () => void,
): Promise<void> {
  try {
    await browser.runtime.sendMessage({
      type: "openWorkspace",
      workspaceId,
    });
    toast.success("Workspace opened successfully");
    onClose?.();
  } catch (error) {
    console.error("Failed to open workspace:", error);
    toast.error("Failed to open workspace");
  }
}
