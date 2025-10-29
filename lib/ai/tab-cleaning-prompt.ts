/**
 * AI-powered tab cleaning prompt for Chrome Extension
 * This prompt is designed to work with local AI models via Chrome's Prompt API
 */

export interface TabInfo {
  id: number;
  title: string;
  url: string;
}

export interface AICleanResponse {
  tabsToClose: number[];
}

export const AI_CLEAN_PROMPT = `You are a helpful assistant that helps organize and clean browser tabs.

Your task is to analyze a list of browser tabs and identify which ones should be closed based on the user's specific cleaning instructions.

Rules:
1. Only close tabs that clearly match the user's cleaning instructions
2. Be conservative - if you're not sure a tab should be closed, leave it
3. Include all tab IDs that should be closed in the tabsToClose array
4. Never close tabs that are essential or don't match the instructions

Analyze the following tabs and identify which ones to close:`;

export function formatTabsForCleanPrompt(tabs: TabInfo[]): string {
  return JSON.stringify(tabs, null, 2);
}

export function validateAICleanResponse(
  response: string,
): AICleanResponse | null {
  try {
    const parsed = JSON.parse(response);

    // Validate the structure
    if (!Array.isArray(parsed.tabsToClose)) {
      return null;
    }

    // Validate tab IDs in the array
    for (const tabId of parsed.tabsToClose) {
      if (typeof tabId !== "number") {
        return null;
      }
    }

    return parsed as AICleanResponse;
  } catch (error) {
    console.error("Invalid AI clean response:", error);
    return null;
  }
}
