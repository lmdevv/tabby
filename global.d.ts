// Global type declarations for Chrome built-in AI APIs
import { LanguageModel } from "./lib/types";

declare global {
  interface Window {
    LanguageModel: LanguageModel;
  }
}
