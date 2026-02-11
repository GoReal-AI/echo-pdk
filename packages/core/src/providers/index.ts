/**
 * @fileoverview Providers module - barrel exports
 *
 * Unified AI provider system for echo-pdk.
 * Provides discovery, model listing, completion, and high-level prompt execution.
 */

// Types
export type {
  ProviderType,
  ProviderInfo,
  ProviderConfig,
  ModelInfo,
  ChatMessage,
  CompletionResponse,
  CompletionOptions,
  AIProviderInstance,
} from './types.js';

// Registry
export {
  isProviderType,
  getProviders,
  getProvider,
  createProvider,
  listModels,
} from './registry.js';

// Provider factories (for direct use)
export { createOpenAIProvider } from './openai.js';
export { createAnthropicProvider } from './anthropic.js';

// High-level API
export { runPrompt } from './run-prompt.js';
export type { RunPromptOptions, RunPromptResult } from './run-prompt.js';

// Utilities (for advanced use / testing)
export { toLLMProvider } from './base.js';
