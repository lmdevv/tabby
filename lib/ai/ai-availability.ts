import type { LanguageModelAvailability } from "@/lib/types/ai-types";

/**
 * Checks if the Chrome built-in AI LanguageModel is available
 * @returns Promise resolving to availability status
 */
export async function checkAIModelAvailability(): Promise<LanguageModelAvailability> {
  try {
    // Check if the API is available in the browser
    if (!("LanguageModel" in window)) {
      return "unavailable";
    }

    const availability = await window.LanguageModel.availability();
    return availability;
  } catch (error) {
    console.error("Error checking AI model availability:", error);
    return "unavailable";
  }
}

/**
 * Checks if the AI model is ready to use (available or downloadable)
 * @returns Promise resolving to boolean indicating if model can be used
 */
export async function isAIModelReady(): Promise<boolean> {
  const availability = await checkAIModelAvailability();
  return (
    availability === "available" ||
    availability === "downloadable" ||
    availability === "downloading"
  );
}
