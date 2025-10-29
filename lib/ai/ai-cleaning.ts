/**
 * AI-powered tab cleaning functionality
 * Handles the logic for cleaning tabs using Chrome's built-in AI
 */

import { browser } from "wxt/browser";
import { cleanSchema } from "@/lib/ai/schemas";
import {
  AI_CLEAN_PROMPT,
  formatTabsForCleanPrompt,
  type TabInfo,
} from "@/lib/ai/tab-cleaning-prompt";
import { db } from "@/lib/db/db";
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
    // Get all tabs in the workspace
    const tabs = await db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .toArray();

    if (tabs.length <= 1) {
      console.log("Not enough tabs to analyze for cleaning");
      return [];
    }

    // Filter out non-active, dashboard and restricted tabs; prepare tab info for AI
    const tabInfo: TabInfo[] = tabs
      .filter((tab) => {
        const ourExtensionBaseURL = browser.runtime.getURL("");
        const specificDashboardURL = browser.runtime.getURL("/dashboard.html");
        const isRestrictedScheme =
          tab.url?.startsWith("chrome://") ||
          tab.url?.startsWith("chrome-extension://") ||
          tab.url === "about:blank";
        return (
          tab.tabStatus === "active" &&
          tab.url !== specificDashboardURL &&
          !tab.url?.startsWith(ourExtensionBaseURL) &&
          !isRestrictedScheme &&
          tab.id !== undefined
        );
      })
      .map((tab) => ({
        id: tab.id as number,
        title: tab.title || "Untitled",
        url: tab.url || "",
      }));

    if (tabInfo.length <= 1) {
      console.log("Not enough non-dashboard tabs to analyze for cleaning");
      return [];
    }

    // Create Firebase AI model with schema enforcement
    const model = await createFirebaseAIModel({ schema: cleanSchema });

    // Prepare the prompt with tab data and custom instructions
    const prompt = `${AI_CLEAN_PROMPT}\n\nIMPORTANT: The user has provided specific cleaning instructions that MUST be followed exactly. Only close tabs that clearly match these instructions. Be conservative - if you're not sure, don't close the tab.\n\nCleaning Instructions: ${customInstructions}\n\n${formatTabsForCleanPrompt(tabInfo)}`;

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

    // Filter to only include tab IDs that actually exist in our tab info
    const existingTabIds = new Set(tabInfo.map((tab) => tab.id));
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
