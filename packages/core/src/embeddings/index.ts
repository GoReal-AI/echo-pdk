/**
 * @fileoverview Embeddings module — barrel exports
 */

// Types
export type {
  EmbeddingProviderType,
  EmbeddingConfig,
  EmbeddingProvider,
} from './types.js';

// Pure math
export { cosineSimilarity } from './cosine.js';

// Provider factories
export { createOpenAIEmbeddingProvider } from './openai.js';
export { createVoyageEmbeddingProvider } from './voyage.js';

// Registry
export { createEmbeddingProvider, isEmbeddingProviderType } from './registry.js';
