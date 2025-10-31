import {
  type Schema,
  type GenerativeModel,
  GoogleAIBackend,
  getAI,
  getGenerativeModel,
  InferenceMode,
} from "firebase/ai";
import { initializeApp } from "firebase/app";
import { stateCache } from "@/lib/db/cache-manager";

const firebaseConfig = {
  apiKey: "AIzaSyBAXUMqvmmCz40rtii24DdxSQ3IBnjk2-E",
  authDomain: "tabby-ed02f.firebaseapp.com",
  projectId: "tabby-ed02f",
  storageBucket: "tabby-ed02f.firebasestorage.app",
  messagingSenderId: "1051399937967",
  appId: "1:1051399937967:web:6c798b2796d26d9815195a",
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
