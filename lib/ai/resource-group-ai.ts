/**
 * AI-powered resource group title and description generation
 * Uses Chrome's built-in AI to generate concise titles and descriptions for resource groups
 */

import { buildWorkspaceAIContext } from "@/lib/ai/context";
import { resourceGroupSchema } from "@/lib/ai/schemas";
import { db } from "@/lib/db/db";
import { createFirebaseAIModel } from "@/lib/firebase/app";
import type { Resource } from "@/lib/types/types";

export interface ResourceGroupSuggestion {
  title: string;
  description: string;
}

export interface AIResourceGroupResponse {
  title: string;
  description: string;
}

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

/**
 * Generate a title and description for a resource group using AI
 */
export async function generateResourceGroupTitleAndDescription(
  resourceIds: string[],
  workspaceId?: number,
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

    // Create Firebase AI model with schema enforcement
    const model = await createFirebaseAIModel({ schema: resourceGroupSchema });

    // Prepare the prompt with resource data and optional workspace context
    let prompt = AI_RESOURCE_GROUP_PROMPT;

    if (workspaceId !== undefined) {
      try {
        const workspaceContext = await buildWorkspaceAIContext(workspaceId);
        // Create a slimmed version of context for resource grouping
        const contextForPrompt = {
          workspaceId: workspaceContext.workspaceId,
          tabCount: workspaceContext.tabs.length,
          groupCount: workspaceContext.groups.length,
          windowCount: workspaceContext.windows?.length || 1,
          // Include group names to help with thematic context
          existingGroupNames: workspaceContext.groups
            .map((g) => g.title)
            .filter(Boolean),
        };
        prompt += `\n\nWorkspace Context: ${JSON.stringify(contextForPrompt, null, 2)}`;
      } catch (error) {
        console.warn(
          "Failed to build workspace context for resource grouping:",
          error,
        );
        // Continue without context
      }
    }

    prompt += `\n\n${formatResourcesForPrompt(resources)}`;

    console.log("=== AI RESOURCE GROUP DEBUG ===");
    console.log("Resources to analyze:", resources.length);
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
    let parsedResponse: AIResourceGroupResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (error) {
      console.error("❌ Failed to parse AI response as JSON:", error);
      return null;
    }

    console.log("✅ Valid AI response format");
    console.log("Generated title:", parsedResponse.title);
    console.log("Generated description:", parsedResponse.description);

    return {
      title: parsedResponse.title.trim(),
      description: parsedResponse.description.trim(),
    };
  } catch (error) {
    console.error(
      "❌ Failed to generate resource group title and description:",
      error,
    );
    return null;
  }
}
