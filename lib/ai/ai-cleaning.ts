/**
 * AI-powered tab cleaning functionality
 * Handles the logic for cleaning tabs using Chrome's built-in AI
 */

import { browser } from "wxt/browser";
import {
  AI_CLEAN_PROMPT,
  AI_CLEAN_RESPONSE_SCHEMA,
  formatTabsForCleanPrompt,
  type TabInfo,
  validateAICleanResponse,
} from "@/lib/ai/tab-cleaning-prompt";
import { db } from "@/lib/db/db";

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

    // Check if Chrome Prompt API is available
    if (
      typeof (globalThis as Record<string, unknown>).LanguageModel ===
      "undefined"
    ) {
      throw new Error("Chrome Prompt API not available");
    }

    const LanguageModel = (globalThis as Record<string, unknown>)
      .LanguageModel as {
      availability(): Promise<string>;
      create(options?: {
        expectedInputs?: {
          type: "text" | "image" | "audio";
          languages?: string[];
        }[];
        expectedOutputs?: { type: "text"; languages?: string[] }[];
        temperature?: number;
        topK?: number;
        signal?: AbortSignal;
      }): Promise<{
        prompt(
          text: string,
          options?: {
            temperature?: number;
            responseConstraint?: Record<string, unknown>;
          },
        ): Promise<string>;
        promptStreaming(
          text: string,
          options?: {
            temperature?: number;
            responseConstraint?: Record<string, unknown>;
          },
        ): ReadableStream<string>;
      }>;
    };

    // Check model availability
    const availability = await LanguageModel.availability();
    if (availability !== "available") {
      throw new Error(`Language model not available. Status: ${availability}`);
    }

    console.log("Using Chrome's built-in LanguageModel for cleaning analysis");

    // Create a session for the AI model with explicit language expectations
    const session = await LanguageModel.create({
      expectedInputs: [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });

    // Prepare the prompt with tab data and custom instructions
    const prompt = `${AI_CLEAN_PROMPT}\n\nIMPORTANT: The user has provided specific cleaning instructions that MUST be followed exactly. Only close tabs that clearly match these instructions. Be conservative - if you're not sure, don't close the tab.\n\nCleaning Instructions: ${customInstructions}\n\n${formatTabsForCleanPrompt(tabInfo)}`;

    console.log("=== AI CLEAN ANALYSIS DEBUG ===");
    console.log("Custom cleaning instructions:", customInstructions);
    console.log("Sending prompt to AI model:");
    console.log(prompt);
    console.log("Using JSON Schema constraint:");
    console.log(JSON.stringify(AI_CLEAN_RESPONSE_SCHEMA, null, 2));
    console.log("=====================");

    // Use streaming for better performance
    const stream = session.promptStreaming(prompt, {
      temperature: 0.3,
      responseConstraint: AI_CLEAN_RESPONSE_SCHEMA,
    });

    let fullResponse = "";
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullResponse += value;
      }
    } finally {
      reader.releaseLock();
    }

    console.log("=== AI CLEAN RESPONSE ===");
    console.log(fullResponse);
    console.log("==================");

    // Try to validate the response
    const validatedResponse = validateAICleanResponse(fullResponse);
    if (!validatedResponse) {
      console.log("❌ Invalid AI response format");
      console.log("Raw response:", fullResponse);
      return [];
    }

    console.log("✅ Valid AI response format");
    console.log(
      "Tabs proposed for cleaning:",
      validatedResponse.tabsToClose.length,
    );

    // Filter to only include tab IDs that actually exist in our tab info
    const existingTabIds = new Set(tabInfo.map((tab) => tab.id));
    const validProposedIds = validatedResponse.tabsToClose.filter((id) =>
      existingTabIds.has(id),
    );

    if (validProposedIds.length !== validatedResponse.tabsToClose.length) {
      console.log(
        `⚠️ Filtered out ${
          validatedResponse.tabsToClose.length - validProposedIds.length
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
