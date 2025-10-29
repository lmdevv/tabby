/**
 * AI-powered tab group title generation
 * Uses Chrome's built-in AI to generate concise titles for tab groups
 */

import { tabGroupSchema } from "@/lib/ai/schemas";
import { db } from "@/lib/db/db";
import { createFirebaseAIModel } from "@/lib/firebase/app";
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

    // Create Firebase AI model with schema enforcement
    const model = await createFirebaseAIModel({ schema: tabGroupSchema });

    // Prepare the prompt with tab data
    const prompt = `${AI_TAB_GROUP_PROMPT}\n\n${formatTabsForPrompt(tabs)}`;

    console.log("=== AI TAB GROUP DEBUG ===");
    console.log("Tabs to analyze:", tabs.length);
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
    let parsedResponse: { title: string };
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (error) {
      console.error("❌ Failed to parse AI response as JSON:", error);
      return null;
    }

    console.log("✅ Valid AI response format");
    console.log("Generated title:", parsedResponse.title);

    return {
      title: parsedResponse.title.trim(),
    };
  } catch (error) {
    console.error("❌ Failed to generate tab group title:", error);
    return null;
  }
}
