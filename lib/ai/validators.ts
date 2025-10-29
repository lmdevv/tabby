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
 * Validate that all active tabs in the workspace context are accounted for
 * in either groups[].tabIds or ungroupedTabs arrays
 */
export function validateFullCoverage(
  context: WorkspaceContext,
  response: AIGroupResponse,
): ValidationResult {
  const errors: string[] = [];

  // Collect all tab IDs from the context
  const contextTabIds = new Set<number>();
  for (const window of context.windows) {
    for (const tab of window.tabs) {
      contextTabIds.add(tab.id);
    }
  }

  // Collect all tab IDs mentioned in the AI response
  const responseTabIds = new Set<number>();

  // Add tab IDs from groups
  for (const group of response.groups) {
    for (const tabId of group.tabIds) {
      if (responseTabIds.has(tabId)) {
        errors.push(`Tab ${tabId} appears in multiple groups`);
      }
      responseTabIds.add(tabId);
    }
  }

  // Add tab IDs from ungrouped tabs
  for (const tabId of response.ungroupedTabs || []) {
    if (responseTabIds.has(tabId)) {
      errors.push(`Tab ${tabId} appears in both groups and ungrouped tabs`);
    }
    responseTabIds.add(tabId);
  }

  // Check for missing tabs
  for (const contextTabId of contextTabIds) {
    if (!responseTabIds.has(contextTabId)) {
      errors.push(`Tab ${contextTabId} is missing from AI response`);
    }
  }

  // Check for extra tabs not in context
  for (const responseTabId of responseTabIds) {
    if (!contextTabIds.has(responseTabId)) {
      errors.push(
        `Tab ${responseTabId} in AI response does not exist in workspace`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
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

  // Build a map of tab ID to window ID for quick lookup
  const tabToWindow = new Map<number, number>();
  for (const window of context.windows) {
    for (const tab of window.tabs) {
      tabToWindow.set(tab.id, window.windowId);
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
 */
export function validateAIGroupingResponse(
  context: WorkspaceContext,
  response: AIGroupResponse,
): ValidationResult {
  const coverage = validateFullCoverage(context, response);
  const windowValidation = validateByWindow(context, response);

  const allErrors = [...coverage.errors, ...windowValidation.errors];

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}
