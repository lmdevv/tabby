import { useLiveQuery } from "dexie-react-hooks";
import { settingsCache } from "@/lib/cache-manager";
import { db } from "@/lib/db";
import {
  getDefaultValue,
  type SettingKey,
  type SettingValue,
} from "@/lib/settings-defs";

/**
 * Strongly typed hook to get a specific setting value
 * Provides full type safety with autocomplete for setting keys
 * Uses localStorage cache for instant loading while DB loads in background
 */
export function useSetting<K extends SettingKey>(key: K) {
  const defaultValue = getDefaultValue(key);

  // Get cached value for instant loading (parsed to correct type)
  const cachedValue = settingsCache.getParsedCachedItem(key, defaultValue);

  const result = useLiveQuery(
    async () => {
      try {
        const setting = await db.settings.where("key").equals(key).first();
        if (!setting) {
          // Setting doesn't exist, use default and update cache
          settingsCache.updateCachedItem(key, String(defaultValue));
          return { data: defaultValue, error: null };
        }

        // Parse the value based on the expected type
        let parsedValue: SettingValue<K>;

        if (typeof defaultValue === "boolean") {
          parsedValue = (setting.value === "true") as SettingValue<K>;
        } else {
          // String or union types (including numbers stored as strings)
          parsedValue = setting.value as SettingValue<K>;
        }

        // Update cache with fresh DB value (store as string for consistency)
        settingsCache.updateCachedItem(key, String(parsedValue));

        return { data: parsedValue, error: null };
      } catch (error) {
        return {
          data: cachedValue ?? defaultValue,
          error:
            error instanceof Error ? error : new Error(JSON.stringify(error)),
        };
      }
    },
    [key],
    // Use cached value as default while DB loads
    cachedValue !== null
      ? { data: cachedValue, error: null }
      : { data: defaultValue, error: null },
  );

  if (result === undefined) {
    // Still loading from DB, use cache or default
    return {
      data: cachedValue ?? (defaultValue as SettingValue<K>),
      loading: true,
      error: null,
    };
  }

  return {
    data: result.data as SettingValue<K>,
    loading: false,
    error: result.error,
  };
}

/**
 * Hook for updating a setting value with type safety
 * Updates both DB and cache atomically
 */
export function useUpdateSetting() {
  const updateSetting = async (
    key: string,
    value: string | boolean | number,
  ) => {
    try {
      const now = Date.now();
      const settingValue = String(value);

      // Use a transaction to ensure atomicity
      await db.transaction("rw", db.settings, async () => {
        await db.settings.where("key").equals(key).modify({
          value: settingValue,
          updatedAt: now,
        });

        // If no rows were modified, it means the setting doesn't exist, so add it
        const existingCount = await db.settings
          .where("key")
          .equals(key)
          .count();
        if (existingCount === 0) {
          await db.settings.add({
            key,
            value: settingValue,
            createdAt: now,
            updatedAt: now,
          });
        }
      });

      // Update cache immediately (store as string for consistency)
      settingsCache.updateCachedItem(key, String(value));

      return null;
    } catch (error) {
      return error instanceof Error ? error : new Error(JSON.stringify(error));
    }
  };

  return { updateSetting };
}

/**
 * Hook for toggling a boolean setting with type safety
 */
export function useToggleSetting<K extends SettingKey>(key: K) {
  const { data: currentValue } = useSetting(key);
  const { updateSetting } = useUpdateSetting();

  const toggle = () => {
    updateSetting(key, !currentValue);
  };

  return {
    value: currentValue ?? getDefaultValue(key),
    toggle,
    loading: currentValue === undefined,
  };
}
