/**
 * Application state definitions - single source of truth for all application state
 * This file defines the type-safe state schema with their default values
 */

import { InferenceMode } from "firebase/ai";
import type { Theme } from "../types/types";

// Define the state definition map
export const stateDefs = {
  // UI Display State
  showTags: { default: true as boolean },
  showUrls: { default: true as boolean },
  showResources: { default: true as boolean },

  // Theme State
  theme: { default: "system" as Theme },

  // Sidebar State
  sidebarCollapsed: { default: false as boolean },

  // Tab Management State
  selectedTabs: { default: [] as number[] },
  previewMode: { default: false as boolean },
  autoGroupTabs: { default: false as boolean },
  confirmTabClose: { default: true as boolean },
  confirmAIClean: { default: true as boolean },

  // Snapshot State
  "snapshot:retentionDays": { default: 7 as number },

  // Window Navigation State
  activeWindowId: { default: "-1" as string },

  // AI / Hybrid Inference Settings
  "ai:mode": { default: InferenceMode.ONLY_IN_CLOUD as InferenceMode },
} as const;

// Extract the state key type from the definitions
export type StateKey = keyof typeof stateDefs;

// Extract the state value type for a specific key
export type StateValue<K extends StateKey> = (typeof stateDefs)[K]["default"];

// Helper type for all possible state values
export type StateValues = {
  [K in StateKey]: StateValue<K>;
};

// Helper to get the default value for a state key
export function getDefaultValue<K extends StateKey>(key: K): StateValue<K> {
  return stateDefs[key].default;
}
