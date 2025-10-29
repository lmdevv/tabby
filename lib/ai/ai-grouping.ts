/**
 * AI-powered tab grouping functionality
 * Handles the logic for grouping tabs using Chrome's built-in AI
 */

import { browser } from "wxt/browser";
import { buildWorkspaceAIContext } from "@/lib/ai/context";
import { groupingSchema } from "@/lib/ai/schemas";
import {
  AI_GROUP_PROMPT,
  type AIGroupResponse,
  formatWorkspaceContextForPrompt,
} from "@/lib/ai/tab-grouping-prompt";
import { validateAIGroupingResponse } from "@/lib/ai/validators";
import { db } from "@/lib/db/db";
import { createFirebaseAIModel } from "@/lib/firebase/app";
import { getRandomTabGroupColor } from "@/lib/helpers/tab-helpers";
import { normalizeToBrowserGroupColor } from "@/lib/ui/tab-group-colors";

/**
 * Main function to group tabs in a workspace using AI with custom instructions
 */
export async function aiGroupTabsInWorkspaceCustom(
  workspaceId: number,
  customPrompt?: string,
): Promise<void> {
  try {
    // Build hierarchical workspace context
    const workspaceContext = await buildWorkspaceAIContext(workspaceId);

    if (workspaceContext.tabs.length <= 1) {
      console.log("Not enough non-dashboard tabs to group");
      return;
    }

    // Create Firebase AI model with schema enforcement
    const model = await createFirebaseAIModel({ schema: groupingSchema });

    // Prepare the prompt with workspace context and custom instructions
    const prompt = `${AI_GROUP_PROMPT}\n\nIMPORTANT: The user has provided specific custom instructions that MUST be followed exactly. Do NOT add, remove, or modify these instructions in any way. Follow them precisely as written:\n\nCustom Instructions: ${customPrompt}\n\n${formatWorkspaceContextForPrompt(workspaceContext)}`;

    console.log("=== AI CUSTOM GROUP DEBUG ===");
    console.log("Custom instructions:", customPrompt);
    console.log("Sending prompt to AI model:");
    console.log(prompt);
    console.log("=====================");

    // Generate content with schema-enforced JSON output
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log("=== AI RESPONSE ===");
    console.log(responseText);
    console.log("==================");

    // Parse the schema-enforced JSON response
    let parsedResponse: AIGroupResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (error) {
      console.error("❌ Failed to parse AI response as JSON:", error);
      return;
    }

    console.log("✅ Valid AI response format");
    console.log("Groups to create:", parsedResponse.groups.length);

    // Validate AI response against workspace context
    const validation = validateAIGroupingResponse(
      workspaceContext,
      parsedResponse,
    );
    if (!validation.valid) {
      console.error("❌ AI response validation failed:", validation.errors);
      return;
    }

    console.log("✅ AI response passed validation");

    // Apply the AI's grouping suggestions
    await applyAIGrouping(workspaceId, parsedResponse);

    console.log(`✅ AI custom grouping completed for workspace ${workspaceId}`);
  } catch (error) {
    console.error(
      `❌ Failed to AI custom group tabs in workspace ${workspaceId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Main function to group tabs in a workspace using AI
 */
export async function aiGroupTabsInWorkspace(workspaceId: number) {
  try {
    // Build hierarchical workspace context
    const workspaceContext = await buildWorkspaceAIContext(workspaceId);

    if (workspaceContext.tabs.length <= 1) {
      console.log("Not enough tabs to group");
      return;
    }

    // Create Firebase AI model with schema enforcement
    const model = await createFirebaseAIModel({ schema: groupingSchema });

    // Prepare the prompt with workspace context
    const prompt = `${AI_GROUP_PROMPT}\n\n${formatWorkspaceContextForPrompt(workspaceContext)}`;

    console.log("=== AI GROUP DEBUG ===");
    console.log("Sending prompt to AI model:");
    console.log(prompt);
    console.log("=====================");

    // Generate content with schema-enforced JSON output
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log("=== AI RESPONSE ===");
    console.log(responseText);
    console.log("==================");

    // Parse the schema-enforced JSON response
    let parsedResponse: AIGroupResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (error) {
      console.error("❌ Failed to parse AI response as JSON:", error);
      return;
    }

    console.log("✅ Valid AI response format");
    console.log("Groups to create:", parsedResponse.groups.length);

    // Validate AI response against workspace context
    const validation = validateAIGroupingResponse(
      workspaceContext,
      parsedResponse,
    );
    if (!validation.valid) {
      console.error("❌ AI response validation failed:", validation.errors);
      return;
    }

    console.log("✅ AI response passed validation");

    // Apply the AI's grouping suggestions
    await applyAIGrouping(workspaceId, parsedResponse);

    console.log(`✅ AI grouping completed for workspace ${workspaceId}`);
  } catch (error) {
    console.error(
      `❌ Failed to AI group tabs in workspace ${workspaceId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Apply AI-generated grouping to tabs in a workspace
 *
 * Behavior:
 * - Creates new groups for each AI-suggested group
 * - Ungroups tabs explicitly listed in ungroupedTabs
 * - AI performs pure replacement - existing groups are preserved but new ones are added
 * - Window boundaries are respected automatically (tabs grouped by their current window)
 */
async function applyAIGrouping(
  workspaceId: number,
  aiResponse: AIGroupResponse,
) {
  try {
    // Get all tabs in the workspace to verify they exist (DB-side)
    const workspaceTabs = await db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .toArray();

    // Only consider tabs that are currently active in DB
    const activeWorkspaceTabs = workspaceTabs.filter(
      (t) => t.tabStatus === "active",
    );

    // Create a map of tab IDs for quick lookup (DB-side)
    const tabMap = new Map(activeWorkspaceTabs.map((tab) => [tab.id, tab]));

    // Query currently existing browser tabs and build a set of live tab IDs
    const allBrowserTabs = await browser.tabs.query({});
    const liveTabIds = new Set(
      allBrowserTabs
        .map((t) => t.id)
        .filter((id): id is number => id !== undefined),
    );

    // Process each AI-suggested group
    for (const group of aiResponse.groups) {
      // Deduplicate, then filter tab IDs to only include tabs that exist both in our workspace DB and in the live browser
      const candidateTabIds = Array.from(new Set(group.tabIds)).filter(
        (tabId) => tabMap.has(tabId) && liveTabIds.has(tabId),
      );

      if (candidateTabIds.length >= 2) {
        try {
          // Fallback to original per-window grouping logic
          const byWindow = new Map<number, number[]>();
          for (const tabId of candidateTabIds) {
            try {
              const liveTab = await browser.tabs.get(tabId);
              if (typeof liveTab.windowId === "number") {
                if (!byWindow.has(liveTab.windowId))
                  byWindow.set(liveTab.windowId, []);
                byWindow.get(liveTab.windowId)?.push(tabId);
              }
            } catch {
              // Skip tabs that no longer exist between query and action
            }
          }

          // Create groups for each window
          for (const [windowId, windowTabIds] of byWindow) {
            if (windowTabIds.length >= 2) {
              const groupId = await browser.tabs.group({
                tabIds: windowTabIds as [number, ...number[]],
                createProperties: { windowId },
              });

              // Update the group with the AI-suggested name and color (if provided) or random
              const groupColor = group.color
                ? normalizeToBrowserGroupColor(group.color) ||
                  getRandomTabGroupColor()
                : getRandomTabGroupColor();

              await browser.tabGroups.update(groupId, {
                title: group.name,
                color: groupColor,
              });

              console.log(
                `✅ Created AI group "${group.name}" with ${windowTabIds.length} tabs in window ${windowId}`,
              );
            }
          }
        } catch (groupError) {
          console.error(
            `❌ Failed to create AI group "${group.name}":`,
            groupError,
          );
        }
      } else {
        console.log(
          `⚠️ Skipping group "${group.name}" - not enough valid tabs (${candidateTabIds.length})`,
        );
      }
    }

    // Handle ungrouped tabs (if any) - explicitly ungroup tabs listed in ungroupedTabs
    // This ensures tabs that should remain standalone are not accidentally grouped
    if (aiResponse.ungroupedTabs?.length) {
      const validUngroupedTabIds = aiResponse.ungroupedTabs.filter(
        (tabId) => tabMap.has(tabId) && liveTabIds.has(tabId),
      );

      for (const tabId of validUngroupedTabIds) {
        try {
          await browser.tabs.ungroup(tabId);
          console.log(`✅ Ungrouped tab ${tabId} as requested`);
        } catch (ungroupError) {
          console.error(`❌ Failed to ungroup tab ${tabId}:`, ungroupError);
        }
      }

      console.log(
        `ℹ️ ${validUngroupedTabIds.length} tabs ungrouped as requested (${aiResponse.ungroupedTabs.length - validUngroupedTabIds.length} invalid)`,
      );
    }

    console.log(`✅ Applied AI grouping for workspace ${workspaceId}`);
  } catch (error) {
    console.error(
      `❌ Failed to apply AI grouping for workspace ${workspaceId}:`,
      error,
    );
    throw error;
  }
}
