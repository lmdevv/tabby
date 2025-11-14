/**
 * TOON (Token-Oriented Object Notation) utilities for AI prompts
 * Provides encoding/decoding functions to reduce token usage in LLM interactions
 */

import { decode, encode } from "@toon-format/toon";

/**
 * Encode data to TOON format for use in AI prompts
 * Reduces token count by 30-60% compared to JSON
 */
export function encodeForPrompt(data: unknown): string {
  try {
    return encode(data);
  } catch (error) {
    console.warn("Failed to encode data to TOON, falling back to JSON:", error);
    return JSON.stringify(data, null, 2);
  }
}

/**
 * Decode TOON format back to JavaScript object
 * Note: AI responses still come back as JSON, so this is mainly for future use
 */
export function decodeFromPrompt(toonString: string): unknown {
  try {
    return decode(toonString);
  } catch (error) {
    console.warn("Failed to decode TOON data, attempting JSON parse:", error);
    try {
      return JSON.parse(toonString);
    } catch (jsonError) {
      console.error("Failed to parse as JSON either:", jsonError);
      throw error;
    }
  }
}
