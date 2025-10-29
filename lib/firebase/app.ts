import {
  type AI as FirebaseAI,
  type Schema as FirebaseSchema,
  GoogleAIBackend,
  getAI,
  getGenerativeModel,
  InferenceMode,
} from "firebase/ai";
import { type FirebaseApp, initializeApp } from "firebase/app";
import { stateCache } from "@/lib/db/cache-manager";
import type { FirebaseAIModel, HybridAIMode } from "@/lib/types/ai-types";
import { getFirebaseEnvConfig } from "./env";

let firebaseAppSingleton: FirebaseApp | null = null;
let aiClientSingleton: FirebaseAI | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (firebaseAppSingleton) return firebaseAppSingleton;
  const config = getFirebaseEnvConfig();
  if (!config) return null;
  firebaseAppSingleton = initializeApp(config);
  return firebaseAppSingleton;
}

/**
 * Returns a Firebase AI client configured with GoogleAIBackend, or null if env is missing.
 */
export function getAIClient(): FirebaseAI | null {
  if (aiClientSingleton) return aiClientSingleton;
  const app = getFirebaseApp();
  if (!app) return null;
  aiClientSingleton = getAI(app, { backend: new GoogleAIBackend() });
  return aiClientSingleton;
}

function mapToFirebaseInferenceMode(mode: HybridAIMode): InferenceMode {
  switch (mode) {
    case "only_on_device":
      return InferenceMode.ONLY_ON_DEVICE;
    case "prefer_on_device":
      return InferenceMode.PREFER_ON_DEVICE;
    case "prefer_in_cloud":
      return InferenceMode.PREFER_IN_CLOUD;
    case "only_in_cloud":
      return InferenceMode.ONLY_IN_CLOUD;
  }
}

/**
 * Creates a Firebase AI model with hybrid inference mode and structured output configuration.
 */
export async function createFirebaseAIModel(
  options: {
    schema?: FirebaseSchema;
    modelName?: string;
    responseMimeType?: string;
    modeOverride?: HybridAIMode;
  } = {},
): Promise<FirebaseAIModel> {
  const ai = getAIClient();
  if (!ai) {
    throw new Error(
      "Firebase AI not configured; set VITE_FIREBASE_* env variables",
    );
  }

  const mode =
    options.modeOverride ??
    (stateCache.getCachedItem("ai:mode") as HybridAIMode | null) ??
    "prefer_on_device";

  const modelName = options.modelName ?? "gemini-2.0-flash-lite";
  const responseMimeType = options.responseMimeType ?? "application/json";

  // Build generation config for cloud-hosted models
  const generationConfig: {
    responseMimeType: string;
    responseSchema?: FirebaseSchema;
  } = {
    responseMimeType,
  };
  if (options.schema) {
    generationConfig.responseSchema = options.schema;
  }

  // Build prompt options for on-device models
  const promptOptions: {
    responseConstraint?: FirebaseSchema;
  } = {};
  if (options.schema) {
    promptOptions.responseConstraint = options.schema;
  }

  return getGenerativeModel(ai, {
    mode: mapToFirebaseInferenceMode(mode),
    inCloudParams: {
      model: modelName,
      generationConfig,
    },
    onDeviceParams: {
      promptOptions,
    },
  });
}
