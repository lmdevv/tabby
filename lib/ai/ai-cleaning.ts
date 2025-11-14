/**
 * AI-powered tab cleaning functionality
 * Handles the logic for cleaning tabs using Chrome's built-in AI
 */

import {
  buildWorkspaceAIContext,
  type WorkspaceContext,
} from "@/lib/ai/context";
import { cleanSchema } from "@/lib/ai/schemas";
import { AI_CLEAN_PROMPT } from "@/lib/ai/tab-cleaning-prompt";
import { encodeForPrompt } from "@/lib/ai/toon-utils";
import { createFirebaseAIModel } from "@/lib/firebase/app";

/**
 * Get AI-proposed tabs to clean in a workspace using custom instructions
 * Returns the proposed tab IDs without performing any cleaning actions
 */
export async function getAIProposedTabsToClean(
  workspaceId: number,
  customInstructions: string,
): Promise<number[]> {
  try {
    // Build simplified workspace context
    const workspaceContext = await buildWorkspaceAIContext(workspaceId);

    if (workspaceContext.tabs.length <= 1) {
      console.log("Not enough tabs to analyze for cleaning");
      return [];
    }

    // Create Firebase AI model with schema enforcement
    const model = await createFirebaseAIModel({ schema: cleanSchema });

    // Create a function to format workspace context for cleaning prompt
    const formatWorkspaceContextForCleanPrompt = (
      context: WorkspaceContext,
    ): string => {
      // For cleaning, we provide simplified context with essential tab and group info
      const contextObj = {
        workspaceId: context.workspaceId,
        groups: context.groups,
        tabs: context.tabs,
        ...(context.windows && { windows: context.windows }),
      };
      return encodeForPrompt(contextObj);
    };

    // Prepare the prompt with workspace context and custom instructions
    const prompt = `${AI_CLEAN_PROMPT}\n\nIMPORTANT: The user has provided specific cleaning instructions that MUST be followed exactly. Only close tabs that clearly match these instructions. Be conservative - if you're not sure, don't close the tab. Consider tab properties like pinned, audible, muted, and lastAccessed when making decisions.\n\nCleaning Instructions: ${customInstructions}\n\n${formatWorkspaceContextForCleanPrompt(workspaceContext)}`;

    console.log("=== AI CLEAN ANALYSIS DEBUG ===");
    console.log("Custom cleaning instructions:", customInstructions);
    console.log("Sending prompt to AI model:");
    console.log(prompt);
    console.log("=====================");

    // Generate content with schema-enforced JSON output
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log("=== AI CLEAN RESPONSE ===");
    console.log(responseText);
    console.log("==================");

    // Parse the schema-enforced JSON response
    let parsedResponse: { tabsToClose: number[] };
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (error) {
      console.error("❌ Failed to parse AI response as JSON:", error);
      return [];
    }

    console.log("✅ Valid AI response format");
    console.log(
      "Tabs proposed for cleaning:",
      parsedResponse.tabsToClose.length,
    );

    // Filter to only include tab IDs that actually exist in our workspace context
    const existingTabIds = new Set(workspaceContext.tabs.map((tab) => tab.id));
    const validProposedIds = parsedResponse.tabsToClose.filter((id) =>
      existingTabIds.has(id),
    );

    if (validProposedIds.length !== parsedResponse.tabsToClose.length) {
      console.log(
        `⚠️ Filtered out ${
          parsedResponse.tabsToClose.length - validProposedIds.length
        } invalid tab IDs from AI response`,
      );
    }

    return validProposedIds;
  } catch (error) {
    console.error(
      `❌ Failed to get AI cleaning proposals for workspace ${workspaceId}:`,
      error,
    );
    throw error;
  }
}
