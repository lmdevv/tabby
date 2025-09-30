import { useLiveQuery } from "dexie-react-hooks";
import { startTransition, useActionState, useCallback } from "react";
import { db } from "@/lib/db";
import {
  getDefaultValue,
  type SettingKey,
  type SettingValue,
} from "@/lib/settings-defs";

/**
 * Strongly typed hook to get a specific setting value
 * Provides full type safety with autocomplete for setting keys
 */
export function useSetting<K extends SettingKey>(key: K) {
  const defaultValue = getDefaultValue(key);

  const result = useLiveQuery(async () => {
    try {
      const setting = await db.settings.where("key").equals(key).first();
      if (!setting) {
        return { data: defaultValue, error: null };
      }

      // Parse the value based on the expected type
      let parsedValue: SettingValue<K>;

      if (typeof defaultValue === "boolean") {
        parsedValue = (setting.value === "true") as SettingValue<K>;
      } else if (typeof defaultValue === "number") {
        parsedValue = Number(setting.value) as SettingValue<K>;
      } else {
        // String or union types
        parsedValue = setting.value as SettingValue<K>;
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
 * Hook for updating a setting value with type safety
 */
export function useUpdateSetting() {
  const [state, action, pending] = useActionState(
    async (
      _: Error | null,
      { key, value }: { key: string; value: string | boolean | number },
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
 * Hook for toggling a boolean setting with type safety
 */
export function useToggleSetting<K extends SettingKey>(key: K) {
  const { data: currentValue } = useSetting(key);
  const { updateSetting } = useUpdateSetting();

  const toggle = useCallback(() => {
    console.log(
      `Toggling setting ${key} from ${currentValue} to ${!currentValue}`,
    );
    updateSetting(key, !currentValue);
  }, [key, currentValue, updateSetting]);

  return {
    value: currentValue ?? getDefaultValue(key),
    toggle,
    loading: currentValue === undefined,
  };
}
