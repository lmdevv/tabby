/**
 * AI-powered tab group title generation
 * Uses Chrome's built-in AI to generate concise titles for tab groups
 */

import { db } from "@/lib/db/db";
import type { LanguageModel } from "@/lib/types/ai-types";
import type { Tab } from "@/lib/types/types";

export interface TabGroupSuggestion {
  title: string;
}

// JSON Schema for structured output validation
export const AI_TAB_GROUP_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      minLength: 1,
      maxLength: 50,
      description: "A concise, descriptive title for the tab group",
    },
  },
  required: ["title"],
  additionalProperties: false,
};

const AI_TAB_GROUP_PROMPT = `You are a helpful assistant that creates concise titles for collections of browser tabs.

Your task is to analyze a list of browser tabs and create a short, descriptive title (max 50 characters) that captures the common theme or purpose.

Rules:
- Title should be concise but descriptive (e.g., "React Development", "Email & Communication", "Research Papers")
- Focus on the common themes, topics, or purposes across the tabs
- Keep the title under 50 characters
- Make it relevant and useful for organization

Analyze the following tabs and create a title:`;

function formatTabsForPrompt(tabs: Tab[]): string {
  return JSON.stringify(
    tabs.map((tab) => ({
      title: tab.title || "Untitled",
      url: tab.url || "",
    })),
    null,
    2,
  );
}

function validateAITabGroupResponse(
  response: string,
): { title: string } | null {
  try {
    const parsed = JSON.parse(response);

    // Validate the structure
    if (
      typeof parsed.title !== "string" ||
      !parsed.title.trim() ||
      parsed.title.length > 50
    ) {
      return null;
    }

    return parsed as { title: string };
  } catch (error) {
    console.error("Invalid AI tab group response:", error);
    return null;
  }
}

/**
 * Generate a title for a tab group using AI
 */
export async function generateTabGroupTitle(
  tabIds: number[],
): Promise<TabGroupSuggestion | null> {
  try {
    if (tabIds.length === 0) {
      console.log("No tabs to analyze");
      return null;
    }

    // Get tabs from database
    const tabs = await db.activeTabs.where("id").anyOf(tabIds).toArray();

    if (tabs.length === 0) {
      console.log("No tabs found in database");
      return null;
    }

    // Check if Chrome Prompt API is available
    if (
      typeof (globalThis as Record<string, unknown>).LanguageModel ===
      "undefined"
    ) {
      throw new Error("Chrome Prompt API not available");
    }

    const LanguageModel = (
      globalThis as typeof globalThis & { LanguageModel: LanguageModel }
    ).LanguageModel;

    // Check model availability
    const availability = await LanguageModel.availability();
    if (availability !== "available") {
      throw new Error(`Language model not available. Status: ${availability}`);
    }

    console.log(
      "Using Chrome's built-in LanguageModel for tab group title generation",
    );

    // Create a session for the AI model with explicit language expectations
    const session = await LanguageModel.create({
      expectedInputs: [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
      temperature: 0.3,
      topK: 40,
    });

    // Prepare the prompt with tab data
    const prompt = `${AI_TAB_GROUP_PROMPT}\n\n${formatTabsForPrompt(tabs)}`;

    console.log("=== AI TAB GROUP DEBUG ===");
    console.log("Tabs to analyze:", tabs.length);
    console.log("Sending prompt to AI model:");
    console.log(prompt);
    console.log("Using JSON Schema constraint:");
    console.log(JSON.stringify(AI_TAB_GROUP_RESPONSE_SCHEMA, null, 2));
    console.log("=====================");

    // Use streaming for better performance
    const stream = session.promptStreaming(prompt, {
      responseConstraint: AI_TAB_GROUP_RESPONSE_SCHEMA,
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

    // Validate the response
    const validatedResponse = validateAITabGroupResponse(fullResponse);
    if (!validatedResponse) {
      console.log("❌ Invalid AI response format");
      console.log("Raw response:", fullResponse);
      return null;
    }

    console.log("✅ Valid AI response format");
    console.log("Generated title:", validatedResponse.title);

    return {
      title: validatedResponse.title.trim(),
    };
  } catch (error) {
    console.error("❌ Failed to generate tab group title:", error);
    return null;
  }
}
