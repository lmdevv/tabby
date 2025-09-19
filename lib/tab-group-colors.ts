import type { Browser } from "wxt/browser";

// Browser supported tab group colors
export type BrowserTabGroupColor = Browser.tabGroups.ColorEnum;

// Our UI color definitions that map to browser colors
export interface TabGroupColor {
  name: string;
  value: string; // hex color for UI display
  browserValue: BrowserTabGroupColor; // browser enum value
}

export const TAB_GROUP_COLORS: TabGroupColor[] = [
  { name: "Blue", value: "#3b82f6", browserValue: "blue" },
  { name: "Cyan", value: "#06b6d4", browserValue: "cyan" },
  { name: "Green", value: "#10b981", browserValue: "green" },
  { name: "Grey", value: "#6b7280", browserValue: "grey" },
  { name: "Orange", value: "#f97316", browserValue: "orange" },
  { name: "Pink", value: "#ec4899", browserValue: "pink" },
  { name: "Purple", value: "#a855f7", browserValue: "purple" },
  { name: "Red", value: "#ef4444", browserValue: "red" },
  { name: "Yellow", value: "#eab308", browserValue: "yellow" },
];

// Convert hex color to browser enum
export function hexToBrowserColor(hexColor: string): BrowserTabGroupColor {
  const color = TAB_GROUP_COLORS.find((c) => c.value === hexColor);
  return color ? color.browserValue : "blue"; // default to blue if not found
}

// Convert browser enum to hex color
export function browserColorToHex(browserColor: BrowserTabGroupColor): string {
  const color = TAB_GROUP_COLORS.find((c) => c.browserValue === browserColor);
  return color ? color.value : TAB_GROUP_COLORS[0].value; // default to first color if not found
}

// Get the default color (first in the list)
export function getDefaultTabGroupColor(): TabGroupColor {
  return TAB_GROUP_COLORS[0];
}
