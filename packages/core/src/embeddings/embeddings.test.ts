/**
 * @fileoverview Unit tests for the embeddings module
 *
 * Tests cover:
 * - cosineSimilarity: identical, orthogonal, opposite, dimension mismatch
 * - OpenAI provider: mock fetch, URL/headers/body, vector ordering
 * - Voyage provider: mock fetch, URL/headers/body, vector ordering
 * - Registry: isEmbeddingProviderType, createEmbeddingProvider
 * - similar_to assertion: prefers embeddings over LLM, falls back, threshold
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cosineSimilarity } from './cosine.js';
import { createOpenAIEmbeddingProvider } from './openai.js';
import { createVoyageEmbeddingProvider } from './voyage.js';
import { isEmbeddingProviderType, createEmbeddingProvider } from './registry.js';
import { runAssertion } from '../eval/assertions.js';
import type { AssertionContext } from '../eval/assertions.js';
import type { Assertion } from '../eval/types.js';

// =============================================================================
// MOCK HELPERS
// =============================================================================

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function embeddingResponse(embeddings: number[][]) {
  return {
    data: embeddings.map((embedding, index) => ({ embedding, index })),
  };
}

// =============================================================================
// COSINE SIMILARITY
// =============================================================================

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors', () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 10);
  });

  it('returns 1.0 for scaled vectors', () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 10);
  });

  it('returns 0.0 for orthogonal vectors', () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 10);
  });

  it('returns -1.0 for opposite vectors', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 10);
  });

  it('throws on dimension mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('Dimension mismatch');
  });

  it('throws on zero-length vectors', () => {
    expect(() => cosineSimilarity([], [])).toThrow('zero-length');
  });

  it('returns 0 for zero vectors', () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });
});

// =============================================================================
// OPENAI EMBEDDING PROVIDER
// =============================================================================

describe('createOpenAIEmbeddingProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct request to OpenAI API', async () => {
    const vectors = [[0.1, 0.2], [0.3, 0.4]];
    const fetchMock = mockFetch(embeddingResponse(vectors));
    vi.stubGlobal('fetch', fetchMock);

    const provider = createOpenAIEmbeddingProvider({
      type: 'openai',
      apiKey: 'sk-test',
    });

    await provider.embed(['hello', 'world']);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/embeddings');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Authorization']).toBe('Bearer sk-test');

    const body = JSON.parse(opts.body);
    expect(body.input).toEqual(['hello', 'world']);
    expect(body.model).toBe('text-embedding-3-small');
  });

  it('uses custom model and base URL', async () => {
    const fetchMock = mockFetch(embeddingResponse([[0.1]]));
    vi.stubGlobal('fetch', fetchMock);

    const provider = createOpenAIEmbeddingProvider({
      type: 'openai',
      apiKey: 'sk-test',
      model: 'text-embedding-3-large',
      baseUrl: 'https://custom.api.com/',
    });

    await provider.embed(['test']);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://custom.api.com/v1/embeddings');
    const body = JSON.parse(opts.body);
    expect(body.model).toBe('text-embedding-3-large');
  });

  it('returns vectors in correct order even if API returns them out of order', async () => {
    const response = {
      data: [
        { embedding: [0.3, 0.4], index: 1 },
        { embedding: [0.1, 0.2], index: 0 },
      ],
    };
    vi.stubGlobal('fetch', mockFetch(response));

    const provider = createOpenAIEmbeddingProvider({
      type: 'openai',
      apiKey: 'sk-test',
    });

    const result = await provider.embed(['first', 'second']);
    expect(result[0]).toEqual([0.1, 0.2]);
    expect(result[1]).toEqual([0.3, 0.4]);
  });

  it('throws on API error', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'bad request' }, 400));

    const provider = createOpenAIEmbeddingProvider({
      type: 'openai',
      apiKey: 'sk-test',
    });

    await expect(provider.embed(['test'])).rejects.toThrow('OpenAI Embeddings');
  });

  it('has type = openai', () => {
    const provider = createOpenAIEmbeddingProvider({
      type: 'openai',
      apiKey: 'sk-test',
    });
    expect(provider.type).toBe('openai');
  });
});

// =============================================================================
// VOYAGE EMBEDDING PROVIDER
// =============================================================================

describe('createVoyageEmbeddingProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct request to Voyage API', async () => {
    const vectors = [[0.5, 0.6]];
    const fetchMock = mockFetch(embeddingResponse(vectors));
    vi.stubGlobal('fetch', fetchMock);

    const provider = createVoyageEmbeddingProvider({
      type: 'voyage',
      apiKey: 'pa-test',
    });

    await provider.embed(['hello']);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.voyageai.com/v1/embeddings');
    expect(opts.headers['Authorization']).toBe('Bearer pa-test');

    const body = JSON.parse(opts.body);
    expect(body.model).toBe('voyage-3-lite');
  });

  it('uses custom model', async () => {
    vi.stubGlobal('fetch', mockFetch(embeddingResponse([[0.1]])));

    const provider = createVoyageEmbeddingProvider({
      type: 'voyage',
      apiKey: 'pa-test',
      model: 'voyage-3',
    });

    await provider.embed(['test']);

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.model).toBe('voyage-3');
  });

  it('returns vectors in correct order', async () => {
    const response = {
      data: [
        { embedding: [0.3], index: 1 },
        { embedding: [0.1], index: 0 },
      ],
    };
    vi.stubGlobal('fetch', mockFetch(response));

    const provider = createVoyageEmbeddingProvider({
      type: 'voyage',
      apiKey: 'pa-test',
    });

    const result = await provider.embed(['a', 'b']);
    expect(result[0]).toEqual([0.1]);
    expect(result[1]).toEqual([0.3]);
  });

  it('throws on API error', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'unauthorized' }, 401));

    const provider = createVoyageEmbeddingProvider({
      type: 'voyage',
      apiKey: 'bad-key',
    });

    await expect(provider.embed(['test'])).rejects.toThrow('Voyage AI Embeddings');
  });

  it('has type = voyage', () => {
    const provider = createVoyageEmbeddingProvider({
      type: 'voyage',
      apiKey: 'pa-test',
    });
    expect(provider.type).toBe('voyage');
  });
});

// =============================================================================
// REGISTRY
// =============================================================================

describe('isEmbeddingProviderType', () => {
  it('returns true for "openai"', () => {
    expect(isEmbeddingProviderType('openai')).toBe(true);
  });

  it('returns true for "voyage"', () => {
    expect(isEmbeddingProviderType('voyage')).toBe(true);
  });

  it('returns false for "anthropic"', () => {
    expect(isEmbeddingProviderType('anthropic')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isEmbeddingProviderType('')).toBe(false);
  });

  it('returns false for random string', () => {
    expect(isEmbeddingProviderType('cohere')).toBe(false);
  });
});

describe('createEmbeddingProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates OpenAI provider', () => {
    const provider = createEmbeddingProvider({
      type: 'openai',
      apiKey: 'sk-test',
    });
    expect(provider.type).toBe('openai');
  });

  it('creates Voyage provider', () => {
    const provider = createEmbeddingProvider({
      type: 'voyage',
      apiKey: 'pa-test',
    });
    expect(provider.type).toBe('voyage');
  });

  it('throws for unknown type', () => {
    expect(() =>
      createEmbeddingProvider({
        type: 'unknown' as 'openai',
        apiKey: 'key',
      })
    ).toThrow('Unknown embedding provider type');
  });
});

// =============================================================================
// SIMILAR_TO ASSERTION INTEGRATION
// =============================================================================

describe('similar_to assertion with embeddings', () => {
  it('prefers embeddingSimilarity over LLM', async () => {
    const embeddingSimilarity = vi.fn().mockResolvedValue(0.95);
    const llmSimilarity = vi.fn().mockResolvedValue(0.8);

    const ctx: AssertionContext = {
      text: 'test output',
      llmProvider: {
        complete: vi.fn(),
        judge: vi.fn(),
        similarity: llmSimilarity,
      },
      loadGolden: async () => 'golden text',
      embeddingSimilarity,
    };

    const assertion: Assertion = { similar_to: { dataset: 'test', threshold: 0.9 } };
    const result = await runAssertion(assertion, ctx);

    expect(result.status).toBe('pass');
    expect(result.actual).toContain('embeddings');
    expect(embeddingSimilarity).toHaveBeenCalledWith('test output', 'golden text');
    expect(llmSimilarity).not.toHaveBeenCalled();
  });

  it('falls back to LLM when no embeddingSimilarity', async () => {
    const llmSimilarity = vi.fn().mockResolvedValue(0.85);

    const ctx: AssertionContext = {
      text: 'test output',
      llmProvider: {
        complete: vi.fn(),
        judge: vi.fn(),
        similarity: llmSimilarity,
      },
      loadGolden: async () => 'golden text',
    };

    const assertion: Assertion = { similar_to: { dataset: 'test', threshold: 0.8 } };
    const result = await runAssertion(assertion, ctx);

    expect(result.status).toBe('pass');
    expect(result.actual).toContain('llm');
    expect(llmSimilarity).toHaveBeenCalled();
  });

  it('fails when score is below threshold', async () => {
    const ctx: AssertionContext = {
      text: 'test output',
      loadGolden: async () => 'golden text',
      embeddingSimilarity: async () => 0.5,
    };

    const assertion: Assertion = { similar_to: { dataset: 'test', threshold: 0.8 } };
    const result = await runAssertion(assertion, ctx);

    expect(result.status).toBe('fail');
    expect(result.actual).toContain('0.500');
  });

  it('errors when neither embeddings nor LLM is configured', async () => {
    const ctx: AssertionContext = {
      text: 'test output',
      loadGolden: async () => 'golden text',
    };

    const assertion: Assertion = { similar_to: { dataset: 'test', threshold: 0.8 } };
    const result = await runAssertion(assertion, ctx);

    expect(result.status).toBe('error');
    expect(result.message).toContain('No embedding or LLM provider configured');
  });
});
