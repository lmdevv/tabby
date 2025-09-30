import { useLiveQuery } from "dexie-react-hooks";
import { startTransition, useActionState, useCallback } from "react";
import { db } from "@/lib/db";
import {
  getDefaultValue,
  isValidSettingKey,
  type SettingKey,
  type SettingValue,
} from "@/lib/settings-defs";
import type { AppSettings } from "@/lib/types";

/**
 * Internal hook to get a specific setting value by key with type safety
 */
function useSetting<K extends SettingKey>(
  key: K,
): {
  data: SettingValue<K> | undefined;
  loading: boolean;
  error: Error | null;
} {
  const defaultValue = getDefaultValue(key);

  const result = useLiveQuery(async () => {
    try {
      const setting = await db.settings.where("key").equals(key).first();
      if (!setting) {
        return { data: defaultValue, error: null };
      }

      // Parse the value based on the expected type
      let parsedValue: SettingValue<K>;
      const rawValue = setting.value;

      if (typeof defaultValue === "boolean") {
        parsedValue = (rawValue === "true") as SettingValue<K>;
      } else if (typeof defaultValue === "number") {
        parsedValue = Number(rawValue) as SettingValue<K>;
      } else {
        // String or union types
        parsedValue = rawValue as SettingValue<K>;
      }

      return { data: parsedValue, error: null };
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof Error ? error : new Error(JSON.stringify(error)),
      };
    }
  }, [key]);

  if (result === undefined) {
    return { data: undefined, loading: true, error: null };
  }

  return {
    data: result.data as SettingValue<K> | undefined,
    loading: false,
    error: result.error,
  };
}

/**
 * Strongly typed hook to get a specific setting value
 * Provides full type safety with autocomplete for setting keys
 */
export function useTypedSetting<K extends SettingKey>(key: K) {
  const { data, loading, error } = useSetting(key);
  const defaultValue = getDefaultValue(key);

  return {
    value: (data ?? defaultValue) as SettingValue<K>,
    loading,
    error,
    isDefault: data === undefined,
  };
}

/**
 * Hook to get all settings (for debugging/admin purposes)
 */
export function useSettings(): AppSettings[] | undefined {
  return useLiveQuery(() => db.settings.toArray(), []);
}

/**
 * Internal hook for updating a setting value with type safety
 */
function useUpdateSetting() {
  const [state, action, pending] = useActionState(
    async (
      _: Error | null,
      { key, value }: { key: string; value: string | boolean | number },
    ) => {
      try {
        // Validate that the key is a valid setting key
        if (!isValidSettingKey(key)) {
          throw new Error(`Invalid setting key: ${key}`);
        }

        const now = Date.now();
        const settingValue = String(value);

        // Use put for atomic insert/update (works with unique index)
        await db.settings.put({
          key,
          value: settingValue,
          createdAt: now,
          updatedAt: now,
        });

        return null;
      } catch (error) {
        return error instanceof Error
          ? error
          : new Error(JSON.stringify(error));
      }
    },
    null,
  );

  const updateSetting = useCallback(
    (key: string, value: string | boolean | number) => {
      startTransition(() => {
        action({ key, value });
      });
    },
    [action],
  );

  return {
    updateSetting,
    error: state,
    pending,
  };
}

/**
 * Strongly typed hook for updating settings
 * Provides type-safe setting updates with compile-time key validation
 */
export function useSetTypedSetting() {
  const { updateSetting, error, pending } = useUpdateSetting();

  const set = useCallback(
    <K extends SettingKey>(key: K, value: SettingValue<K>) => {
      updateSetting(key, value);
    },
    [updateSetting],
  );

  return {
    set,
    error,
    pending,
  };
}

/**
 * Hook for toggling a boolean setting with type safety
 */
export function useToggleSetting<K extends SettingKey>(key: K) {
  const { value: currentValue, loading } = useTypedSetting(key);
  const { set } = useSetTypedSetting();

  const toggle = useCallback(() => {
    console.log(
      `Toggling setting ${key} from ${currentValue} to ${!currentValue}`,
    );
    set(key, !currentValue);
  }, [key, currentValue, set]);

  return {
    value: currentValue,
    toggle,
    loading,
  };
}

/**
 * Hook to get multiple settings at once for better performance
 */
export function useMultipleSettings<K extends SettingKey>(keys: K[]) {
  const results = useLiveQuery(async () => {
    try {
      const settingsMap = new Map<K, SettingValue<K>>();
      const settings = await db.settings.where("key").anyOf(keys).toArray();

      // Initialize with defaults
      keys.forEach((key) => {
        settingsMap.set(key, getDefaultValue(key));
      });

      // Override with actual values
      settings.forEach((setting) => {
        if (isValidSettingKey(setting.key) && keys.includes(setting.key as K)) {
          const key = setting.key as K;
          const defaultValue = getDefaultValue(key);
          let parsedValue: SettingValue<K>;

          if (typeof defaultValue === "boolean") {
            parsedValue = (setting.value === "true") as SettingValue<K>;
          } else if (typeof defaultValue === "number") {
            parsedValue = Number(setting.value) as SettingValue<K>;
          } else {
            parsedValue = setting.value as SettingValue<K>;
          }

          settingsMap.set(key, parsedValue);
        }
      });

      return { data: settingsMap, error: null };
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof Error ? error : new Error(JSON.stringify(error)),
      };
    }
  }, [keys.join(",")]);

  if (results === undefined) {
    return { data: undefined, loading: true, error: null };
  }

  if (results.error) {
    return { data: undefined, loading: false, error: results.error };
  }

  return {
    data: results.data,
    loading: false,
    error: null,
  };
}
