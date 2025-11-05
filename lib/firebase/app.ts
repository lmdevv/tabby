import {
  type GenerativeModel,
  GoogleAIBackend,
  getAI,
  getGenerativeModel,
  InferenceMode,
  type Schema,
} from "firebase/ai";
import { initializeApp } from "firebase/app";
import { stateCache } from "@/lib/db/cache-manager";

const firebaseConfig = {
  apiKey: "AIzaSyC5-9m_fCvRqE0n5Ci3ixXZjFkCwD47f-U",
  authDomain: "tabby-dev-efc89.firebaseapp.com",
  projectId: "tabby-dev-efc89",
  storageBucket: "tabby-dev-efc89.firebasestorage.app",
  messagingSenderId: "382763198981",
  appId: "1:382763198981:web:bb768b13a77269eaa34a6c",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const ai = getAI(app, { backend: new GoogleAIBackend() });

/**
 * Creates a Firebase AI model with hybrid inference mode and structured output configuration.
 */
export async function createFirebaseAIModel(
  options: {
    schema?: Schema;
    modelName?: string;
    responseMimeType?: string;
    modeOverride?: InferenceMode;
  } = {},
): Promise<GenerativeModel> {
  const mode =
    options.modeOverride ??
    (stateCache.getCachedItem("ai:mode") as InferenceMode) ??
    InferenceMode.PREFER_ON_DEVICE;

  const modelName = options.modelName ?? "gemini-2.0-flash-lite";
  const responseMimeType = options.responseMimeType ?? "application/json";

  // Build generation config for cloud-hosted models
  const generationConfig: {
    responseMimeType: string;
    responseSchema?: Schema;
  } = {
    responseMimeType,
  };
  if (options.schema) {
    generationConfig.responseSchema = options.schema;
  }

  // Build prompt options for on-device models
  const promptOptions: {
    responseConstraint?: Schema;
  } = {};
  if (options.schema) {
    promptOptions.responseConstraint = options.schema;
  }

  return getGenerativeModel(ai, {
    mode,
    inCloudParams: {
      model: modelName,
      generationConfig,
    },
    onDeviceParams: {
      promptOptions,
    },
  });
}
