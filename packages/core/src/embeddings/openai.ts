/**
 * @fileoverview OpenAI embedding provider
 *
 * Uses the POST /v1/embeddings endpoint with text-embedding-3-small by default.
 */

import { fetchWithTimeout, extractApiError } from '../providers/base.js';
import type { EmbeddingConfig, EmbeddingProvider } from './types.js';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_BASE_URL = 'https://api.openai.com';
const DEFAULT_TIMEOUT = 30_000;

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

/**
 * Create an OpenAI embedding provider.
 */
export function createOpenAIEmbeddingProvider(
  config: EmbeddingConfig
): EmbeddingProvider {
  const model = config.model ?? DEFAULT_MODEL;
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;

  return {
    type: 'openai',

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
        throw new Error(await extractApiError(response, 'OpenAI Embeddings'));
      }

      const body = (await response.json()) as OpenAIEmbeddingResponse;

      // API may return embeddings out of order — sort by index
      const sorted = body.data.sort((a, b) => a.index - b.index);
      return sorted.map((d) => d.embedding);
    },
  };
}
