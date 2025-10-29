//
// Chrome Built-in AI API Types
//

// Language Model API Types
export type LanguageModelAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface LanguageModelParams {
  defaultTopK: number;
  maxTopK: number;
  defaultTemperature: number;
  maxTemperature: number;
}

export interface LanguageModelMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
  removeEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
}

export interface DownloadProgressEvent {
  loaded: number; // Progress as a fraction (0.0 to 1.0)
}

export type PromptRole = "system" | "user" | "assistant";

export type PromptContentType = "text" | "image" | "audio";

export interface PromptTextContent {
  type: "text";
  value: string;
}

export interface PromptImageContent {
  type: "image";
  value:
    | Blob
    | ImageData
    | HTMLImageElement
    | HTMLCanvasElement
    | HTMLVideoElement;
}

export interface PromptAudioContent {
  type: "audio";
  value: Blob;
}

export type PromptContent =
  | PromptTextContent
  | PromptImageContent
  | PromptAudioContent;

export interface PromptMessage {
  role: PromptRole;
  content: string | PromptContent[];
  prefix?: boolean; // Only for assistant role to prefill response
}

export interface ExpectedInput {
  type: PromptContentType;
  languages?: string[]; // For text inputs
}

export interface LanguageModelCreateOptions {
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
  initialPrompts?: PromptMessage[];
  expectedInputs?: ExpectedInput[];
  expectedOutputs?: ExpectedInput[];
  monitor?: (monitor: LanguageModelMonitor) => void;
}

// JSON Schema type for response constraints
export interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema | JSONSchema[];
  enum?: unknown[];
  const?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  [key: string]: unknown;
}

export interface PromptOptions {
  signal?: AbortSignal;
  responseConstraint?: JSONSchema;
  omitResponseConstraintInput?: boolean;
}

export interface LanguageModelSession {
  prompt(
    input: string | PromptMessage[],
    options?: PromptOptions,
  ): Promise<string>;
  promptStreaming(
    input: string | PromptMessage[],
    options?: PromptOptions,
  ): ReadableStream<string>;
  append(messages: PromptMessage[]): Promise<void>;
  clone(options?: { signal?: AbortSignal }): Promise<LanguageModelSession>;
  destroy(): void;
  inputUsage: number;
  inputQuota: number;
  measureInputUsage(
    input: string | PromptMessage[],
    options?: PromptOptions,
  ): Promise<number>;
}

export interface LanguageModel {
  availability(): Promise<LanguageModelAvailability>;
  params(): Promise<LanguageModelParams>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

// Summarizer API Types
export type SummarizerAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface SummarizerParams {
  supportedLanguages: string[];
}

export interface SummarizerCreateOptions {
  signal?: AbortSignal;
  monitor?: (monitor: SummarizerMonitor) => void;
}

export interface SummarizerMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
  removeEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
}

export interface SummarizerSession {
  summarize(input: string, options?: { signal?: AbortSignal }): Promise<string>;
  summarizeStreaming(
    input: string,
    options?: { signal?: AbortSignal },
  ): ReadableStream<string>;
  destroy(): void;
}

export interface Summarizer {
  availability(): Promise<SummarizerAvailability>;
  params(): Promise<SummarizerParams>;
  create(options?: SummarizerCreateOptions): Promise<SummarizerSession>;
}

// Writer API Types
export type WriterAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface WriterParams {
  supportedLanguages: string[];
}

export interface WriterCreateOptions {
  signal?: AbortSignal;
  monitor?: (monitor: WriterMonitor) => void;
}

export interface WriterMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
  removeEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
}

export interface WriterSession {
  write(input: string, options?: { signal?: AbortSignal }): Promise<string>;
  writeStreaming(
    input: string,
    options?: { signal?: AbortSignal },
  ): ReadableStream<string>;
  destroy(): void;
}

export interface Writer {
  availability(): Promise<WriterAvailability>;
  params(): Promise<WriterParams>;
  create(options?: WriterCreateOptions): Promise<WriterSession>;
}

// Rewriter API Types
export type RewriterAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface RewriterParams {
  supportedLanguages: string[];
}

export interface RewriterCreateOptions {
  signal?: AbortSignal;
  monitor?: (monitor: RewriterMonitor) => void;
}

export interface RewriterMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
  removeEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
}

export interface RewriterSession {
  rewrite(input: string, options?: { signal?: AbortSignal }): Promise<string>;
  rewriteStreaming(
    input: string,
    options?: { signal?: AbortSignal },
  ): ReadableStream<string>;
  destroy(): void;
}

export interface Rewriter {
  availability(): Promise<RewriterAvailability>;
  params(): Promise<RewriterParams>;
  create(options?: RewriterCreateOptions): Promise<RewriterSession>;
}

// Global window interface extensions for all AI APIs
declare global {
  interface Window {
    LanguageModel: LanguageModel;
    Summarizer: Summarizer;
    Writer: Writer;
    Rewriter: Rewriter;
  }
}

// Hybrid AI Mode (used for Firebase AI Logic routing)
export type HybridAIMode =
  | "only_on_device"
  | "prefer_on_device"
  | "prefer_in_cloud"
  | "only_in_cloud";

// Firebase AI Model interface
export interface FirebaseAIModel {
  generateContent(prompt: string): Promise<{ response: { text(): string } }>;
  generateContentStream(
    prompt: string,
  ): Promise<{ stream: AsyncIterable<{ text(): string }> }>;
}
