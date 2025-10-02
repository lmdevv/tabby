import { useLiveQuery } from "dexie-react-hooks";
import { stateCache } from "@/lib/cache-manager";
import { db } from "@/lib/db";
import {
  getDefaultValue,
  type StateKey,
  type StateValue,
} from "@/lib/state-defs";

/**
 * Strongly typed hook to get a specific state value
 * Provides full type safety with autocomplete for state keys
 * Uses localStorage cache for instant loading while DB loads in background
 */
export function useState<K extends StateKey>(key: K) {
  const defaultValue = getDefaultValue(key);

  // Get cached value for instant loading (parsed to correct type)
  const cachedValue = stateCache.getParsedCachedItem(key, defaultValue);

  const result = useLiveQuery(
    async () => {
      try {
        const state = await db.state.where("key").equals(key).first();
        if (!state) {
          // State doesn't exist, use default and update cache
          stateCache.updateCachedItem(key, String(defaultValue));
          return { data: defaultValue, error: null };
        }

        // Parse the value based on the expected type
        let parsedValue: StateValue<K>;

        if (typeof defaultValue === "boolean") {
          parsedValue = (state.value === "true") as StateValue<K>;
        } else {
          // String or union types (including numbers stored as strings)
          parsedValue = state.value as StateValue<K>;
        }

        // Update cache with fresh DB value (store as string for consistency)
        stateCache.updateCachedItem(key, String(parsedValue));

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
      data: cachedValue ?? (defaultValue as StateValue<K>),
      loading: true,
      error: null,
    };
  }

  return {
    data: result.data as StateValue<K>,
    loading: false,
    error: result.error,
  };
}

/**
 * Hook for updating a state value with type safety
 * Updates both DB and cache atomically
 */
export function useUpdateState() {
  const updateState = async (key: string, value: string | boolean | number) => {
    try {
      const now = Date.now();
      const settingValue = String(value);

      // Use a transaction to ensure atomicity
      await db.transaction("rw", db.state, async () => {
        await db.state.where("key").equals(key).modify({
          value: settingValue,
          updatedAt: now,
        });

        // If no rows were modified, it means the state doesn't exist, so add it
        const existingCount = await db.state.where("key").equals(key).count();
        if (existingCount === 0) {
          await db.state.add({
            key,
            value: settingValue,
            createdAt: now,
            updatedAt: now,
          });
        }
      });

      // Update cache immediately (store as string for consistency)
      stateCache.updateCachedItem(key, String(value));

      return null;
    } catch (error) {
      return error instanceof Error ? error : new Error(JSON.stringify(error));
    }
  };

  return { updateState };
}

/**
 * Hook for toggling a boolean state with type safety
 */
export function useToggleState<K extends StateKey>(key: K) {
  const { data: currentValue } = useState(key);
  const { updateState } = useUpdateState();

  const toggle = () => {
    updateState(key, !currentValue);
  };

  return {
    value: currentValue ?? getDefaultValue(key),
    toggle,
    loading: currentValue === undefined,
  };
}
