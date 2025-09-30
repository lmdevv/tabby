/**
 * Settings definitions - single source of truth for all application settings
 * This file defines the type-safe settings schema with their default values
 */

// Define the settings definition map
export const settingDefs = {
  // UI Display Settings
  showTags: { default: true as boolean },
  showUrls: { default: true as boolean },
  showResources: { default: true as boolean },

  // Theme Settings
  theme: { default: "system" as "light" | "dark" | "system" },

  // Sidebar Settings
  sidebarCollapsed: { default: false as boolean },

  // Tab Management Settings
  previewMode: { default: false as boolean },
  autoGroupTabs: { default: false as boolean },
  confirmTabClose: { default: true as boolean },

  // Performance Settings
  debounceMs: { default: 300 as number },
  maxTabsPerGroup: { default: 50 as number },

  // AI Settings
  enableAI: { default: true as boolean },
  aiModel: { default: "gemini" as "gemini" | "openai" | "local" },

  // Backup & Sync Settings
  autoBackup: { default: true as boolean },
  backupInterval: { default: 24 as number }, // hours

  // Advanced Settings
  debugMode: { default: false as boolean },
  experimentalFeatures: { default: false as boolean },
} as const;

// Extract the setting key type from the definitions
export type SettingKey = keyof typeof settingDefs;

// Extract the setting value type for a specific key
export type SettingValue<K extends SettingKey> =
  (typeof settingDefs)[K]["default"];

// Helper type for all possible setting values
export type SettingValues = {
  [K in SettingKey]: SettingValue<K>;
};

// Helper to get the default value for a setting key
export function getDefaultValue<K extends SettingKey>(key: K): SettingValue<K> {
  return settingDefs[key].default;
}

// Helper to check if a key is a valid setting key
export function isValidSettingKey(key: string): key is SettingKey {
  return key in settingDefs;
}

// Helper to get all setting keys
export function getAllSettingKeys(): SettingKey[] {
  return Object.keys(settingDefs) as SettingKey[];
}

// Helper to get all setting definitions
export function getAllSettingDefinitions() {
  return settingDefs;
}
