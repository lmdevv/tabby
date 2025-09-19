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

// Resolve any group color (enum or hex) to a hex string
export function resolveGroupHex(color: string | BrowserTabGroupColor): string {
  if (typeof color === "string" && color.trim().startsWith("#")) {
    return color.trim();
  }
  return browserColorToHex(color as BrowserTabGroupColor);
}

// Lightweight color helpers kept in this single module for simplicity
export function hexToRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length !== 6) return null;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

// Prefer hex with alpha (#RRGGBBAA) for simplicity and CSS compatibility
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length !== 6) return hex;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${normalized}${a}`;
}

// Compute a readable text color (foreground) for a given hex background.
// Uses simple luminance heuristic to choose black or white.
export function getReadableTextColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return "#111827"; // slate-900 fallback
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  // Relative luminance approximation
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? "#111827" : "#FFFFFF";
}

// Get the default color (first in the list)
export function getDefaultTabGroupColor(): TabGroupColor {
  return TAB_GROUP_COLORS[0];
}
