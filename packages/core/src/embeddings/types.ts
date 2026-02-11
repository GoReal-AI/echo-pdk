/**
 * @fileoverview Embedding provider types
 *
 * Separate from AIProviderInstance because embedding-only providers
 * (like Voyage AI) can't implement completions/judge/listModels.
 */

// =============================================================================
// PROVIDER IDENTITY
// =============================================================================

/**
 * Supported embedding provider types.
 */
export type EmbeddingProviderType = 'openai' | 'voyage';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Configuration for creating an embedding provider.
 */
export interface EmbeddingConfig {
  /** Provider type */
  type: EmbeddingProviderType;
  /** API key */
  apiKey: string;
  /** Model override (defaults: 'text-embedding-3-small' / 'voyage-3-lite') */
  model?: string;
  /** Custom base URL */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

// =============================================================================
// PROVIDER INTERFACE
// =============================================================================

/**
 * Lightweight embedding provider — compute vectors, nothing else.
 */
export interface EmbeddingProvider {
  /** Provider type */
  readonly type: EmbeddingProviderType;
  /** Embed one or more texts, returns one vector per input text. */
  embed(texts: string[]): Promise<number[][]>;
}
