/**
 * AI-powered tab grouping prompt for Chrome Extension
 * This prompt is designed to work with local AI models via Chrome's Prompt API
 */

export interface TabInfo {
  id: number;
  title: string;
  url: string;
}

export interface TabGroup {
  name: string;
  tabIds: number[];
  color?: string;
}

export interface AIGroupResponse {
  groups: TabGroup[];
  ungroupedTabs?: number[];
}

export const AI_GROUP_PROMPT = `You are a helpful assistant that organizes browser tabs into logical groups.

Your task is to analyze a list of browser tabs and group them by related topics, domains, or workflows.

Rules:
1. Group tabs that are related (same domain, similar topics, part of same workflow)
2. Give each group a descriptive name (e.g., "Development", "Communication", "Research")
3. Only create groups when it makes sense - don't force grouping
4. Some tabs can remain ungrouped if they don't fit well anywhere
5. Ensure all tab IDs from the input are included in either groups or ungroupedTabs
6. Keep groups focused and logical
7. Only include a \`color\` field for a group if the user's custom instructions explicitly ask for a specific color; otherwise omit it

Analyze the following tabs and create appropriate groups:`;

export function formatTabsForPrompt(tabs: TabInfo[]): string {
  return JSON.stringify(tabs, null, 2);
}

export function validateAIGroupResponse(
  response: string,
): AIGroupResponse | null {
  try {
    const parsed = JSON.parse(response);

    // Validate the structure
    if (!parsed.groups || !Array.isArray(parsed.groups)) {
      return null;
    }

    // Validate each group
    for (const group of parsed.groups) {
      if (
        typeof group.name !== "string" ||
        !group.name.trim() ||
        !Array.isArray(group.tabIds) ||
        group.tabIds.length < 2
      ) {
        return null;
      }

      // Validate optional color field (if present)
      if (group.color !== undefined && typeof group.color !== "string") {
        return null;
      }

      // Validate tab IDs in each group
      for (const tabId of group.tabIds) {
        if (typeof tabId !== "number") {
          return null;
        }
      }
    }

    // Validate ungrouped tabs (now required)
    if (!parsed.ungroupedTabs || !Array.isArray(parsed.ungroupedTabs)) {
      return null;
    }
    for (const tabId of parsed.ungroupedTabs) {
      if (typeof tabId !== "number") {
        return null;
      }
    }

    return parsed as AIGroupResponse;
  } catch (error) {
    console.error("Invalid AI group response:", error);
    return null;
  }
}
