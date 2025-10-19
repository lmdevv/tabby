import { toast } from "sonner";
import { browser } from "wxt/browser";
import {
  aiGroupTabsInWorkspace,
  aiGroupTabsInWorkspaceCustom,
} from "@/lib/ai/ai-grouping";

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

export async function aiGroupTabsCustom(
  customInstructions: string,
  options: TabOperationsOptions,
): Promise<void> {
  if (!options.workspaceId) {
    toast.error("No workspace selected");
    return;
  }

  if (!customInstructions.trim()) {
    toast.error("Custom instructions cannot be empty");
    return;
  }

  if (customInstructions.length > 250) {
    toast.error("Custom instructions must be 250 characters or less");
    return;
  }

  try {
    toast.loading("Grouping tabs with custom AI...", {
      id: "ai-custom-grouping",
    });
    await aiGroupTabsInWorkspaceCustom(options.workspaceId, customInstructions);
    toast.success("Tabs grouped with custom AI successfully", {
      id: "ai-custom-grouping",
    });
    options.onClose?.();
  } catch (error) {
    console.error("Failed to AI custom group tabs:", error);
    toast.error("Failed to AI custom group tabs", { id: "ai-custom-grouping" });
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

export async function cleanUnusedTabs(
  options: TabOperationsOptions,
): Promise<void> {
  try {
    await browser.runtime.sendMessage({
      type: "cleanUnusedTabs",
      workspaceId: options.workspaceId,
      daysThreshold: 3,
    } as const);
    toast.success("Unused tabs cleaned successfully");
    options.onClose?.();
  } catch (error) {
    console.error("Failed to clean unused tabs:", error);
    toast.error("Failed to clean unused tabs");
  }
}

export async function cleanDuplicateTabs(
  options: TabOperationsOptions,
): Promise<void> {
  try {
    await browser.runtime.sendMessage({
      type: "cleanDuplicateTabs",
      workspaceId: options.workspaceId,
    } as const);
    toast.success("Duplicate tabs cleaned successfully");
    options.onClose?.();
  } catch (error) {
    console.error("Failed to clean duplicate tabs:", error);
    toast.error("Failed to clean duplicate tabs");
  }
}

export async function cleanResourceTabs(
  options: TabOperationsOptions,
): Promise<void> {
  try {
    await browser.runtime.sendMessage({
      type: "cleanResourceTabs",
      workspaceId: options.workspaceId,
    } as const);
    toast.success("Resource tabs cleaned successfully");
    options.onClose?.();
  } catch (error) {
    console.error("Failed to clean resource tabs:", error);
    toast.error("Failed to clean resource tabs");
  }
}

export async function cleanNonResourceTabs(
  options: TabOperationsOptions,
): Promise<void> {
  try {
    await browser.runtime.sendMessage({
      type: "cleanNonResourceTabs",
      workspaceId: options.workspaceId,
    } as const);
    toast.success("Non-resource tabs cleaned successfully");
    options.onClose?.();
  } catch (error) {
    console.error("Failed to clean non-resource tabs:", error);
    toast.error("Failed to clean non-resource tabs");
  }
}
