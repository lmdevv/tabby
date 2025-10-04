/**
 * Common utilities for card components (ResourceCard, TabCard, etc.)
 */

/**
 * Format URL for display by removing protocol and www prefix
 */
export function formatDisplayUrl(url: string | undefined): string {
  if (!url) return "No URL";
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

/**
 * Extract domain from URL for favicon fallback
 */
export function getDomainFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Get domain initial for favicon fallback
 */
export function getDomainInitial(url: string | undefined): string {
  const domain = getDomainFromUrl(url);
  return domain.charAt(0).toUpperCase() || "?";
}

/**
 * Common card data interface
 */
export interface CardData {
  title?: string;
  url?: string;
  favIconUrl?: string;
  tags?: string[];
}
