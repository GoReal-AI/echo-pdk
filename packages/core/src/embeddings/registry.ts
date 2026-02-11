/**
 * @fileoverview Embedding provider registry — dispatcher + type guard.
 */

import type { EmbeddingConfig, EmbeddingProvider, EmbeddingProviderType } from './types.js';
import { createOpenAIEmbeddingProvider } from './openai.js';
import { createVoyageEmbeddingProvider } from './voyage.js';

const VALID_TYPES: ReadonlySet<string> = new Set<EmbeddingProviderType>([
  'openai',
  'voyage',
]);

/**
 * Type guard for embedding provider types.
 */
export function isEmbeddingProviderType(
  value: string
): value is EmbeddingProviderType {
  return VALID_TYPES.has(value);
}

/**
 * Create an embedding provider from config.
 */
export function createEmbeddingProvider(
  config: EmbeddingConfig
): EmbeddingProvider {
  switch (config.type) {
    case 'openai':
      return createOpenAIEmbeddingProvider(config);
    case 'voyage':
      return createVoyageEmbeddingProvider(config);
    default:
      throw new Error(`Unknown embedding provider type: ${config.type as string}`);
  }
}
