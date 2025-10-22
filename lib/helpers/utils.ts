import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

  const locale = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en";
  const rtf = new window.Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  return rtf.format(value, unit);
}
