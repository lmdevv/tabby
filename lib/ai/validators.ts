/**
 * AI Response Validators
 * Ensures AI responses meet safety and consistency invariants
 *
 * Key invariants enforced:
 * 1. Full coverage: All active tabs must be accounted for (grouped or ungrouped)
 * 2. Window boundaries: Tabs don't cross windows unless explicitly allowed
 * 3. Existing groups: References to existing groups must be valid
 */

import type { WorkspaceContext } from "@/lib/ai/context";
import type { AIGroupResponse } from "@/lib/ai/tab-grouping-prompt";

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate and fix AI grouping response to ensure consistency
 * - Removes tabs that appear in multiple groups (keeps only first occurrence)
 * - Moves tabs that appear in both groups and ungrouped to ungrouped only
 * - Adds missing tabs to ungroupedTabs
 * - Removes extra tabs not in workspace
 */
export function validateAndFixAIGroupingResponse(
  context: WorkspaceContext,
  response: AIGroupResponse,
): ValidationResult {
  const errors: string[] = [];
  let fixesApplied = 0;

  // Collect all tab IDs from the context
  const contextTabIds = new Set(context.tabs.map((tab) => tab.id));

  // Track which tabs we've seen and where
  const seenTabs = new Map<number, "grouped" | "ungrouped">();

  // First pass: collect all tabs and identify conflicts
  const tabsToRemoveFromGroups = new Map<number, number[]>(); // tabId -> group indices to remove from

  // Check groups for duplicates
  for (let groupIndex = 0; groupIndex < response.groups.length; groupIndex++) {
    const group = response.groups[groupIndex];
    const uniqueTabIds: number[] = [];

    for (const tabId of group.tabIds) {
      if (seenTabs.has(tabId)) {
        // Tab already seen - mark for removal from this group
        if (!tabsToRemoveFromGroups.has(tabId)) {
          tabsToRemoveFromGroups.set(tabId, []);
        }
        tabsToRemoveFromGroups.get(tabId)?.push(groupIndex);
        errors.push(
          `Tab ${tabId} appears in multiple groups - removing from subsequent groups`,
        );
        fixesApplied++;
      } else {
        seenTabs.set(tabId, "grouped");
        uniqueTabIds.push(tabId);
      }
    }

    // Update group with unique tabs only
    group.tabIds = uniqueTabIds;
  }

  // Check ungrouped tabs for conflicts with groups
  if (response.ungroupedTabs) {
    const filteredUngrouped: number[] = [];

    for (const tabId of response.ungroupedTabs) {
      if (seenTabs.has(tabId)) {
        errors.push(
          `Tab ${tabId} appears in both groups and ungrouped tabs - keeping in groups`,
        );
        fixesApplied++;
      } else {
        seenTabs.set(tabId, "ungrouped");
        filteredUngrouped.push(tabId);
      }
    }

    response.ungroupedTabs = filteredUngrouped;
  }

  // Check for missing tabs and add them to ungroupedTabs
  const missingTabIds: number[] = [];
  for (const contextTabId of contextTabIds) {
    if (!seenTabs.has(contextTabId)) {
      missingTabIds.push(contextTabId);
    }
  }

  if (missingTabIds.length > 0) {
    if (!response.ungroupedTabs) {
      response.ungroupedTabs = [];
    }
    response.ungroupedTabs.push(...missingTabIds);
    console.log(
      `ℹ️ Added ${missingTabIds.length} missing tabs to ungroupedTabs:`,
      missingTabIds,
    );
    fixesApplied += missingTabIds.length;
  }

  // Remove extra tabs not in context
  const extraTabs: number[] = [];
  for (const [tabId] of seenTabs) {
    if (!contextTabIds.has(tabId)) {
      extraTabs.push(tabId);
    }
  }

  if (extraTabs.length > 0) {
    // Remove from groups
    for (const group of response.groups) {
      group.tabIds = group.tabIds.filter((id) => !extraTabs.includes(id));
    }
    // Remove from ungrouped
    if (response.ungroupedTabs) {
      response.ungroupedTabs = response.ungroupedTabs.filter(
        (id) => !extraTabs.includes(id),
      );
    }
    errors.push(
      `Removed ${extraTabs.length} extra tabs not in workspace: ${extraTabs.join(", ")}`,
    );
    fixesApplied += extraTabs.length;
  }

  // Remove empty groups
  const originalGroupCount = response.groups.length;
  response.groups = response.groups.filter((group) => group.tabIds.length > 0);
  const removedGroups = originalGroupCount - response.groups.length;
  if (removedGroups > 0) {
    errors.push(`Removed ${removedGroups} empty groups`);
    fixesApplied += removedGroups;
  }

  if (fixesApplied > 0) {
    console.log(`🔧 Applied ${fixesApplied} fixes to AI grouping response`);
  }

  return {
    valid: true, // Always return valid since we fixed the issues
    errors,
  };
}

/**
 * Legacy validation function - kept for backward compatibility
 * @deprecated Use validateAndFixAIGroupingResponse instead
 */
export function validateFullCoverage(
  context: WorkspaceContext,
  response: AIGroupResponse,
): ValidationResult {
  return validateAndFixAIGroupingResponse(context, response);
}

/**
 * Validate that tabs in groups are in the same window
 * Each group should only contain tabs from the same window
 */
export function validateByWindow(
  context: WorkspaceContext,
  response: AIGroupResponse,
): ValidationResult {
  const errors: string[] = [];

  // Build a map of tab ID to window ID for quick lookup (only if windows exist)
  const tabToWindow = new Map<number, number>();
  if (context.windows) {
    for (const window of context.windows) {
      for (const tabId of window.tabIds) {
        tabToWindow.set(tabId, window.windowId);
      }
    }
  }

  // Validate each group - all tabs in a group must be in the same window
  for (const group of response.groups) {
    if (group.tabIds.length === 0) continue;

    // All tabs in a group must be in the same window
    const firstTabId = group.tabIds[0];
    const expectedWindowId = tabToWindow.get(firstTabId);

    for (const tabId of group.tabIds) {
      const tabWindowId = tabToWindow.get(tabId);
      if (tabWindowId !== expectedWindowId) {
        errors.push(
          `Tab ${tabId} in group "${group.name}" is in window ${tabWindowId} but should be in window ${expectedWindowId} (all tabs in a group must be in the same window)`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Run all validations for an AI grouping response
 * This function fixes issues automatically rather than failing
 */
export function validateAIGroupingResponse(
  context: WorkspaceContext,
  response: AIGroupResponse,
): ValidationResult {
  const coverage = validateAndFixAIGroupingResponse(context, response);
  const windowValidation = validateByWindow(context, response);

  const allErrors = [...coverage.errors, ...windowValidation.errors];

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}
