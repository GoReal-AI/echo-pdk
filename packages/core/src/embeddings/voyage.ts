/**
 * @fileoverview Voyage AI embedding provider
 *
 * Voyage AI (for Anthropic users without OpenAI keys).
 * Uses POST /v1/embeddings with voyage-3-lite by default.
 */

import { fetchWithTimeout, extractApiError } from '../providers/base.js';
import type { EmbeddingConfig, EmbeddingProvider } from './types.js';

const DEFAULT_MODEL = 'voyage-3-lite';
const DEFAULT_BASE_URL = 'https://api.voyageai.com';
const DEFAULT_TIMEOUT = 30_000;

interface VoyageEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

/**
 * Create a Voyage AI embedding provider.
 */
export function createVoyageEmbeddingProvider(
  config: EmbeddingConfig
): EmbeddingProvider {
  const model = config.model ?? DEFAULT_MODEL;
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;

  return {
    type: 'voyage',

    async embed(texts: string[]): Promise<number[][]> {
      const response = await fetchWithTimeout(
        `${baseUrl}/v1/embeddings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({ input: texts, model }),
        },
        timeout
      );

      if (!response.ok) {
        throw new Error(await extractApiError(response, 'Voyage AI Embeddings'));
      }

      const body = (await response.json()) as VoyageEmbeddingResponse;

      // Sort by index to guarantee correct ordering
      const sorted = body.data.sort((a, b) => a.index - b.index);
      return sorted.map((d) => d.embedding);
    },
  };
}
