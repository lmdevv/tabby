import { useLiveQuery } from "dexie-react-hooks";
import { startTransition, useActionState, useCallback } from "react";
import { db } from "@/lib/db";
import type { AppSettings } from "@/lib/types";

/**
 * Hook to get a specific setting value by key
 */
export function useSetting<T = string | boolean | number>(
  key: string,
  defaultValue: T,
): { data: T | undefined; loading: boolean; error: Error | null } {
  const result = useLiveQuery(async () => {
    try {
      const setting = await db.settings.where("key").equals(key).first();
      if (!setting) {
        return { data: defaultValue, error: null };
      }

      // Parse the value based on the default value type
      let parsedValue: T;
      if (typeof defaultValue === "boolean") {
        parsedValue = (setting.value === "true") as T;
      } else if (typeof defaultValue === "number") {
        parsedValue = Number(setting.value) as T;
      } else {
        parsedValue = setting.value as string as T;
      }

      return { data: parsedValue, error: null };
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof Error ? error : new Error(JSON.stringify(error)),
      };
    }
  }, [key, defaultValue]);

  if (result === undefined) {
    return { data: undefined, loading: true, error: null };
  }

  return {
    data: result.data as T | undefined,
    loading: false,
    error: result.error,
  };
}

/**
 * Hook to get all settings
 */
export function useSettings(): AppSettings[] | undefined {
  return useLiveQuery(() => db.settings.toArray(), []);
}

/**
 * Hook for updating a setting value
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

        // Check if setting already exists
        const existingSetting = await db.settings
          .where("key")
          .equals(key)
          .first();

        if (existingSetting) {
          // Update existing setting
          await db.settings.update(existingSetting.id, {
            value: settingValue,
            updatedAt: now,
          });
        } else {
          // Create new setting
          await db.settings.add({
            key,
            value: settingValue,
            createdAt: now,
            updatedAt: now,
          });
        }

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
 * Hook for toggling a boolean setting
 */
export function useToggleSetting(key: string, defaultValue: boolean = false) {
  const { data: currentValue } = useSetting(key, defaultValue);
  const { updateSetting } = useUpdateSetting();

  const toggle = useCallback(() => {
    console.log(
      `Toggling setting ${key} from ${currentValue} to ${!currentValue}`,
    );
    updateSetting(key, !currentValue);
  }, [key, currentValue, updateSetting]);

  return {
    value: currentValue ?? defaultValue,
    toggle,
    loading: currentValue === undefined,
  };
}
