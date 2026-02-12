/**
 * @fileoverview Provider type definitions
 *
 * All types for the unified AI provider system.
 * Providers implement AIProviderInstance to expose a consistent interface
 * for completion, model listing, judging, and similarity.
 */

// =============================================================================
// PROVIDER IDENTITY
// =============================================================================

/**
 * Supported AI provider types.
 * Adding a new provider = add to this union + implement factory.
 */
export type ProviderType = 'openai' | 'anthropic';

/**
 * Provider metadata for discovery.
 * Returned by getProviders() so frontends can build provider selectors.
 */
export interface ProviderInfo {
  /** Provider type identifier */
  type: ProviderType;
  /** Human-readable name */
  name: string;
  /** Default API base URL */
  baseUrl: string;
  /** Default model for this provider */
  defaultModel: string;
  /** Environment variable names checked for API key (in priority order) */
  envKeys: string[];
}

// =============================================================================
// PROVIDER CONFIGURATION
// =============================================================================

/**
 * Configuration needed to create a provider instance.
 */
export interface ProviderConfig {
  /** Provider type */
  type: ProviderType;
  /** API key */
  apiKey: string;
  /** Model to use (defaults to provider's defaultModel) */
  model?: string;
  /** Custom base URL (overrides provider default) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

// =============================================================================
// MODELS
// =============================================================================

/**
 * Model information from a live API call.
 * Never hardcoded — always fetched from the provider.
 */
export interface ModelInfo {
  /** Model identifier (e.g., 'gpt-4o', 'claude-sonnet-4-5-20250929') */
  id: string;
  /** Which provider owns this model */
  provider: ProviderType;
  /** Unix timestamp of model creation (if available) */
  createdAt?: number;
  /** Organization that owns the model */
  ownedBy?: string;
}

// =============================================================================
// MESSAGES & RESPONSES
// =============================================================================

/**
 * Chat message for completion requests.
 * Content can be a plain string or an array of content blocks for multimodal
 * messages (e.g., text + images from `renderMultimodal()`).
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | import('../types.js').ContentBlock[];
}

/**
 * Response from a completion call.
 */
export interface CompletionResponse {
  /** The response text */
  text: string;
  /** Token usage */
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Latency in milliseconds */
  latencyMs: number;
  /** Model used */
  model: string;
  /** Provider type */
  provider: ProviderType;
}

// =============================================================================
// COMPLETION OPTIONS
// =============================================================================

/**
 * Options for a chat completion request.
 */
export interface CompletionOptions {
  /** Override the default model for this request */
  model?: string;
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Maximum tokens in the response */
  maxTokens?: number;
}

// =============================================================================
// PROVIDER INSTANCE
// =============================================================================

/**
 * What each provider implements.
 * Created by factory functions (createOpenAIProvider, createAnthropicProvider).
 */
export interface AIProviderInstance {
  /** Provider metadata (frozen — safe to hold a reference) */
  readonly info: ProviderInfo;

  /**
   * Send a chat completion request.
   */
  complete(
    messages: ChatMessage[],
    options?: CompletionOptions
  ): Promise<CompletionResponse>;

  /**
   * List available models from the provider API.
   */
  listModels(): Promise<ModelInfo[]>;

  /**
   * Judge a response against a question.
   * Returns pass/fail with reasoning.
   */
  judge(
    response: string,
    question: string
  ): Promise<{ pass: boolean; reasoning: string }>;

  /**
   * Rate semantic similarity between two texts (0.0-1.0).
   */
  similarity(textA: string, textB: string): Promise<number>;
}
