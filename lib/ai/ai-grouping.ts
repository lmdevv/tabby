/**
 * AI-powered tab grouping functionality
 * Handles the logic for grouping tabs using Chrome's built-in AI
 */

import { browser } from "wxt/browser";
import {
  AI_GROUP_PROMPT,
  AI_GROUP_RESPONSE_SCHEMA,
  type AIGroupResponse,
  formatTabsForPrompt,
  type TabInfo,
  validateAIGroupResponse,
} from "@/lib/ai/tab-grouping-prompt";
import { db } from "@/lib/db/db";
import { getRandomTabGroupColor } from "@/lib/helpers/tab-helpers";

/**
 * Main function to group tabs in a workspace using AI with custom instructions
 */
export async function aiGroupTabsInWorkspaceCustom(
  workspaceId: number,
  customInstructions: string,
) {
  try {
    // Get all tabs in the workspace
    const tabs = await db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .toArray();

    if (tabs.length <= 1) {
      console.log("Not enough tabs to group");
      return;
    }

    // Filter out dashboard tabs and prepare tab info for AI
    const tabInfo: TabInfo[] = tabs
      .filter((tab) => {
        const ourExtensionBaseURL = browser.runtime.getURL("");
        const specificDashboardURL = browser.runtime.getURL("/dashboard.html");
        return (
          tab.url !== specificDashboardURL &&
          !tab.url?.startsWith(ourExtensionBaseURL) &&
          tab.id !== undefined
        );
      })
      .map((tab) => ({
        id: tab.id as number,
        title: tab.title || "Untitled",
        url: tab.url || "",
      }));

    if (tabInfo.length <= 1) {
      console.log("Not enough non-dashboard tabs to group");
      return;
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
      create(): Promise<{
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

    console.log("Using Chrome's built-in LanguageModel");

    // Create a session for the AI model
    const session = await LanguageModel.create();

    // Prepare the prompt with tab data and custom instructions
    const prompt = `${AI_GROUP_PROMPT}\n\nIMPORTANT: The user has provided specific custom instructions that MUST be followed exactly. Do NOT add, remove, or modify these instructions in any way. Follow them precisely as written:\n\nCustom Instructions: ${customInstructions}\n\n${formatTabsForPrompt(tabInfo)}`;

    console.log("=== AI CUSTOM GROUP DEBUG ===");
    console.log("Custom instructions:", customInstructions);
    console.log("Sending prompt to AI model:");
    console.log(prompt);
    console.log("Using JSON Schema constraint:");
    console.log(JSON.stringify(AI_GROUP_RESPONSE_SCHEMA, null, 2));
    console.log("=====================");

    // Use streaming for better performance
    const stream = session.promptStreaming(prompt, {
      temperature: 0.3,
      responseConstraint: AI_GROUP_RESPONSE_SCHEMA,
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

    console.log("=== AI RESPONSE ===");
    console.log(fullResponse);
    console.log("==================");

    // Try to validate the response
    const validatedResponse = validateAIGroupResponse(fullResponse);
    if (!validatedResponse) {
      console.log("❌ Invalid AI response format");
      console.log("Raw response:", fullResponse);
      return;
    }

    console.log("✅ Valid AI response format");
    console.log("Groups to create:", validatedResponse.groups.length);

    // Apply the AI's grouping suggestions
    await applyAIGrouping(workspaceId, validatedResponse);

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
    // Get all tabs in the workspace
    const tabs = await db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .toArray();

    if (tabs.length <= 1) {
      console.log("Not enough tabs to group");
      return;
    }

    // Filter out dashboard tabs and prepare tab info for AI
    const tabInfo: TabInfo[] = tabs
      .filter((tab) => {
        const ourExtensionBaseURL = browser.runtime.getURL("");
        const specificDashboardURL = browser.runtime.getURL("/dashboard.html");
        return (
          tab.url !== specificDashboardURL &&
          !tab.url?.startsWith(ourExtensionBaseURL) &&
          tab.id !== undefined
        );
      })
      .map((tab) => ({
        id: tab.id as number,
        title: tab.title || "Untitled",
        url: tab.url || "",
      }));

    if (tabInfo.length <= 1) {
      console.log("Not enough non-dashboard tabs to group");
      return;
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
      create(): Promise<{
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

    console.log("Using Chrome's built-in LanguageModel");

    // Create a session for the AI model
    const session = await LanguageModel.create();

    // Prepare the prompt with tab data
    const prompt = `${AI_GROUP_PROMPT}\n\n${formatTabsForPrompt(tabInfo)}`;

    console.log("=== AI GROUP DEBUG ===");
    console.log("Sending prompt to AI model:");
    console.log(prompt);
    console.log("Using JSON Schema constraint:");
    console.log(JSON.stringify(AI_GROUP_RESPONSE_SCHEMA, null, 2));
    console.log("=====================");

    // Use streaming for better performance
    const stream = session.promptStreaming(prompt, {
      temperature: 0.3,
      responseConstraint: AI_GROUP_RESPONSE_SCHEMA,
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

    console.log("=== AI RESPONSE ===");
    console.log(fullResponse);
    console.log("==================");

    // Try to validate the response
    const validatedResponse = validateAIGroupResponse(fullResponse);
    if (!validatedResponse) {
      console.log("❌ Invalid AI response format");
      console.log("Raw response:", fullResponse);
      return;
    }

    console.log("✅ Valid AI response format");
    console.log("Groups to create:", validatedResponse.groups.length);

    // Apply the AI's grouping suggestions
    await applyAIGrouping(workspaceId, validatedResponse);

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
 */
async function applyAIGrouping(
  workspaceId: number,
  aiResponse: AIGroupResponse,
) {
  try {
    // Get all tabs in the workspace to verify they exist
    const workspaceTabs = await db.activeTabs
      .where("workspaceId")
      .equals(workspaceId)
      .toArray();

    // Create a map of tab IDs for quick lookup
    const tabMap = new Map(workspaceTabs.map((tab) => [tab.id, tab]));

    // Process each AI-suggested group
    for (const group of aiResponse.groups) {
      // Filter tab IDs to only include tabs that exist in our workspace
      const validTabIds = group.tabIds.filter((tabId) => tabMap.has(tabId));

      if (validTabIds.length >= 2) {
        // Group tabs by their window (tabs in same group should be in same window)
        const tabsByWindow = new Map<number, number[]>();

        for (const tabId of validTabIds) {
          const tab = tabMap.get(tabId);
          if (tab) {
            if (!tabsByWindow.has(tab.windowId)) {
              tabsByWindow.set(tab.windowId, []);
            }
            tabsByWindow.get(tab.windowId)?.push(tabId);
          }
        }

        // Create groups for each window
        for (const [windowId, windowTabIds] of tabsByWindow) {
          if (windowTabIds.length >= 2) {
            try {
              // Create the browser tab group
              const groupId = await browser.tabs.group({
                tabIds: windowTabIds as [number, ...number[]],
                createProperties: { windowId },
              });

              // Update the group with the AI-suggested name and a random color
              await browser.tabGroups.update(groupId, {
                title: group.name,
                color: getRandomTabGroupColor(),
              });

              console.log(
                `✅ Created AI group "${group.name}" with ${windowTabIds.length} tabs in window ${windowId}`,
              );
            } catch (groupError) {
              console.error(
                `❌ Failed to create AI group "${group.name}":`,
                groupError,
              );
            }
          }
        }
      } else {
        console.log(
          `⚠️ Skipping group "${group.name}" - not enough valid tabs (${validTabIds.length})`,
        );
      }
    }

    // Handle ungrouped tabs (if any) - just log them for now
    if (aiResponse.ungroupedTabs?.length) {
      console.log(
        `ℹ️ ${aiResponse.ungroupedTabs.length} tabs left ungrouped as requested`,
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
