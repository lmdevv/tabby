/**
 * AI-powered resource group title and description generation
 * Uses Chrome's built-in AI to generate concise titles and descriptions for resource groups
 */

import { db } from "@/lib/db/db";
import type { LanguageModel } from "@/lib/types/ai-types";
import type { Resource } from "@/lib/types/types";

export interface ResourceGroupSuggestion {
  title: string;
  description: string;
}

export interface AIResourceGroupResponse {
  title: string;
  description: string;
}

// JSON Schema for structured output validation
export const AI_RESOURCE_GROUP_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      minLength: 1,
      maxLength: 50,
      description: "A concise, descriptive title for the resource group",
    },
    description: {
      type: "string",
      minLength: 1,
      maxLength: 80,
      description:
        "A brief description of the resource group (max 80 characters)",
    },
  },
  required: ["title", "description"],
  additionalProperties: false,
};

const AI_RESOURCE_GROUP_PROMPT = `You are a helpful assistant that creates concise titles and descriptions for collections of web resources (bookmarks/tabs).

Your task is to analyze a list of web resources and create:
1. A short, descriptive title (max 50 characters)
2. A brief description (max 80 characters) that captures the common theme or purpose

Rules:
- Title should be concise but descriptive (e.g., "React Development", "Data Science Tools", "Design Inspiration")
- Description should explain what the group is about in one sentence
- Focus on the common themes, topics, or purposes across the resources
- Keep both title and description under their character limits
- Make them relevant and useful for organization

Analyze the following resources and create a title and description:`;

function formatResourcesForPrompt(resources: Resource[]): string {
  return JSON.stringify(
    resources.map((r) => ({
      title: r.title || "Untitled",
      url: r.url || "",
      description: r.description || "",
      tags: r.tags || [],
    })),
    null,
    2,
  );
}

function validateAIResourceGroupResponse(
  response: string,
): AIResourceGroupResponse | null {
  try {
    const parsed = JSON.parse(response);

    // Validate the structure
    if (
      typeof parsed.title !== "string" ||
      !parsed.title.trim() ||
      parsed.title.length > 50 ||
      typeof parsed.description !== "string" ||
      !parsed.description.trim() ||
      parsed.description.length > 80
    ) {
      return null;
    }

    return parsed as AIResourceGroupResponse;
  } catch (error) {
    console.error("Invalid AI resource group response:", error);
    return null;
  }
}

/**
 * Generate a title and description for a resource group using AI
 */
export async function generateResourceGroupTitleAndDescription(
  resourceIds: string[],
): Promise<ResourceGroupSuggestion | null> {
  try {
    if (resourceIds.length === 0) {
      console.log("No resources to analyze");
      return null;
    }

    // Get resources from database
    const resources = await db.resources
      .where("id")
      .anyOf(resourceIds.map((id) => parseInt(id, 10)))
      .toArray();

    if (resources.length === 0) {
      console.log("No resources found in database");
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
      "Using Chrome's built-in LanguageModel for resource group generation",
    );

    // Create a session for the AI model with explicit language expectations
    const session = await LanguageModel.create({
      expectedInputs: [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
      temperature: 0.3,
      topK: 40,
    });

    // Prepare the prompt with resource data
    const prompt = `${AI_RESOURCE_GROUP_PROMPT}\n\n${formatResourcesForPrompt(resources)}`;

    console.log("=== AI RESOURCE GROUP DEBUG ===");
    console.log("Resources to analyze:", resources.length);
    console.log("Sending prompt to AI model:");
    console.log(prompt);
    console.log("Using JSON Schema constraint:");
    console.log(JSON.stringify(AI_RESOURCE_GROUP_RESPONSE_SCHEMA, null, 2));
    console.log("=====================");

    // Use streaming for better performance
    const stream = session.promptStreaming(prompt, {
      responseConstraint: AI_RESOURCE_GROUP_RESPONSE_SCHEMA,
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
    const validatedResponse = validateAIResourceGroupResponse(fullResponse);
    if (!validatedResponse) {
      console.log("❌ Invalid AI response format");
      console.log("Raw response:", fullResponse);
      return null;
    }

    console.log("✅ Valid AI response format");
    console.log("Generated title:", validatedResponse.title);
    console.log("Generated description:", validatedResponse.description);

    return {
      title: validatedResponse.title.trim(),
      description: validatedResponse.description.trim(),
    };
  } catch (error) {
    console.error(
      "❌ Failed to generate resource group title and description:",
      error,
    );
    return null;
  }
}
