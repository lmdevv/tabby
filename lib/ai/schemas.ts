import { Schema } from "firebase/ai";

/**
 * Firebase AI Schema builders for structured responses
 * These schemas ensure consistent JSON output across local and cloud AI models
 */

// AI Cleaning Response Schema
export const cleanSchema = Schema.object({
  properties: {
    tabsToClose: Schema.array({
      items: Schema.number(),
    }),
  },
  required: ["tabsToClose"],
});

// AI Grouping Response Schema
export const groupingSchema = Schema.object({
  properties: {
    groups: Schema.array({
      items: Schema.object({
        properties: {
          name: Schema.string(),
          tabIds: Schema.array({
            items: Schema.number(),
          }),
        },
        required: ["name", "tabIds"],
      }),
    }),
    ungroupedTabs: Schema.array({
      items: Schema.number(),
    }),
  },
  required: ["groups", "ungroupedTabs"],
});

// Resource Group Response Schema
export const resourceGroupSchema = Schema.object({
  properties: {
    title: Schema.string(),
    description: Schema.string(),
  },
  required: ["title", "description"],
});

// Tab Group Response Schema
export const tabGroupSchema = Schema.object({
  properties: {
    title: Schema.string(),
  },
  required: ["title"],
});

// Workspace Response Schema
export const workspaceSchema = Schema.object({
  properties: {
    title: Schema.string(),
  },
  required: ["title"],
});
