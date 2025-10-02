/**
 * Generic localStorage cache manager
 * Provides instant synchronous access during initial loads
 */
export class CacheManager<T = Record<string, string | boolean | number>> {
  private storageKey: string;

  constructor(storageKey: string) {
    this.storageKey = storageKey;
  }

  getCachedData(): T | null {
    try {
      const cached = localStorage.getItem(this.storageKey);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  setCachedData(data: T): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch {
      // Ignore localStorage errors
    }
  }

  getCachedItem<K extends keyof T>(key: K): T[K] | null {
    const cached = this.getCachedData();
    return cached?.[key] ?? null;
  }

  updateCachedItem<K extends keyof T>(key: K, value: T[K]): void {
    const current = this.getCachedData() || ({} as T);
    (current as Record<string, T[K]>)[key as string] = value;
    this.setCachedData(current);
  }

  getParsedCachedItem<K extends keyof T>(key: K, defaultValue: T[K]): T[K] {
    const cached = this.getCachedItem(key);
    if (cached === null) return defaultValue;

    // Parse boolean strings back to booleans
    if (typeof defaultValue === "boolean" && typeof cached === "string") {
      return (cached === "true") as T[K];
    }

    // Parse number strings back to numbers
    if (typeof defaultValue === "number" && typeof cached === "string") {
      return Number(cached) as T[K];
    }

    return cached;
  }
}

/**
 * Specialized cache manager for settings
 */
export class SettingsCacheManager extends CacheManager<
  Record<string, string | boolean | number>
> {
  constructor() {
    super("tabby_settings_cache");
  }
}

// Singleton instance for settings
export const settingsCache = new SettingsCacheManager();
