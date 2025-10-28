import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Derive a display title from URL when title is not available
 */
export function getDisplayTitleFromUrl(url?: string): string {
  if (!url) return "Untitled";
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    // Use hostname if it's a simple path, otherwise use a shortened pathname
    if (pathname === "/" || pathname === "") {
      return hostname;
    }
    // Take the first meaningful part of the path
    const pathParts = pathname.split("/").filter((p) => p.length > 0);
    if (pathParts.length > 0) {
      return `${hostname}/${pathParts[0]}`;
    }
    return hostname;
  } catch {
    return "Untitled";
  }
}

export function getRelativeTime(timestamp: number): string {
  const nowMs = Date.now();
  const deltaSeconds = Math.round((timestamp - nowMs) / 1000);

  const absSeconds = Math.abs(deltaSeconds);

  type Unit = "year" | "month" | "week" | "day" | "hour" | "minute" | "second";
  let unit: Unit;
  let value: number;

  if (absSeconds < 60) {
    unit = "second";
    value = deltaSeconds;
  } else if (absSeconds < 60 * 60) {
    unit = "minute";
    value = Math.round(deltaSeconds / 60);
  } else if (absSeconds < 60 * 60 * 24) {
    unit = "hour";
    value = Math.round(deltaSeconds / (60 * 60));
  } else if (absSeconds < 60 * 60 * 24 * 7) {
    unit = "day";
    value = Math.round(deltaSeconds / (60 * 60 * 24));
  } else if (absSeconds < 60 * 60 * 24 * 30.437) {
    unit = "week";
    value = Math.round(deltaSeconds / (60 * 60 * 24 * 7));
  } else if (absSeconds < 60 * 60 * 24 * 365.25) {
    unit = "month";
    value = Math.round(deltaSeconds / (60 * 60 * 24 * 30.437));
  } else {
    unit = "year";
    value = Math.round(deltaSeconds / (60 * 60 * 24 * 365.25));
  }

  const locale = navigator?.language ? navigator.language : "en";
  const rtf = new window.Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
    style: "short",
  });
  return rtf.format(value, unit);
}
