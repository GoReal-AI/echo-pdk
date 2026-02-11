/**
 * @fileoverview Unit tests for the unified provider system
 *
 * Tests cover:
 * - Registry functions (getProviders, getProvider, createProvider)
 * - OpenAI provider (complete, listModels, judge, similarity)
 * - Anthropic provider (complete, listModels, judge, similarity)
 * - runPrompt high-level API
 * - Base utilities (parseJudgeResponse, parseSimilarityResponse)
 *
 * All HTTP calls are mocked via vi.stubGlobal('fetch', ...).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isProviderType,
  getProviders,
  getProvider,
  createProvider,
  listModels,
} from './registry.js';
import { createOpenAIProvider } from './openai.js';
import { createAnthropicProvider } from './anthropic.js';
import { runPrompt } from './run-prompt.js';
import {
  buildJudgePrompt,
  parseJudgeResponse,
  buildSimilarityPrompt,
  parseSimilarityResponse,
  toLLMProvider,
} from './base.js';
import type { ProviderType } from './types.js';

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

function openAIChatResponse(text: string) {
  return {
    choices: [{ message: { content: text } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    model: 'gpt-4o',
  };
}

function anthropicMessageResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: 10, output_tokens: 5 },
    model: 'claude-sonnet-4-5-20250929',
  };
}

function openAIModelsResponse() {
  return {
    data: [
      { id: 'gpt-4o', created: 1700000000, owned_by: 'openai' },
      { id: 'gpt-4o-mini', created: 1700000001, owned_by: 'openai' },
    ],
  };
}

function anthropicModelsResponse() {
  return {
    data: [
      { id: 'claude-sonnet-4-5-20250929', created_at: '2025-01-01T00:00:00Z', display_name: 'Claude Sonnet 4.5' },
      { id: 'claude-haiku-3-5-20241022', created_at: '2024-10-22T00:00:00Z', display_name: 'Claude 3.5 Haiku' },
    ],
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// REGISTRY TESTS
// =============================================================================

describe('Registry', () => {
  describe('getProviders', () => {
    it('should return all known providers', () => {
      const providers = getProviders();
      expect(providers).toHaveLength(2);
      expect(providers.map((p) => p.type)).toEqual(['openai', 'anthropic']);
    });

    it('should include required metadata for each provider', () => {
      for (const provider of getProviders()) {
        expect(provider.type).toBeDefined();
        expect(provider.name).toBeDefined();
        expect(provider.baseUrl).toBeDefined();
        expect(provider.defaultModel).toBeDefined();
        expect(provider.envKeys).toBeInstanceOf(Array);
        expect(provider.envKeys.length).toBeGreaterThan(0);
      }
    });
  });

  describe('isProviderType', () => {
    it('should return true for known provider types', () => {
      expect(isProviderType('openai')).toBe(true);
      expect(isProviderType('anthropic')).toBe(true);
    });

    it('should return false for unknown strings', () => {
      expect(isProviderType('unknown')).toBe(false);
      expect(isProviderType('')).toBe(false);
      expect(isProviderType('OpenAI')).toBe(false); // case-sensitive
    });
  });

  describe('getProvider', () => {
    it('should return info for openai', () => {
      const info = getProvider('openai');
      expect(info.type).toBe('openai');
      expect(info.name).toBe('OpenAI');
      expect(info.defaultModel).toBe('gpt-4o');
    });

    it('should return info for anthropic', () => {
      const info = getProvider('anthropic');
      expect(info.type).toBe('anthropic');
      expect(info.name).toBe('Anthropic');
      expect(info.defaultModel).toBe('claude-sonnet-4-5-20250929');
    });

    it('should throw for unknown provider type', () => {
      expect(() => getProvider('unknown' as ProviderType)).toThrow('Unknown provider type');
    });
  });

  describe('createProvider', () => {
    it('should create an openai provider', () => {
      const provider = createProvider({ type: 'openai', apiKey: 'sk-test' });
      expect(provider.info.type).toBe('openai');
    });

    it('should create an anthropic provider', () => {
      const provider = createProvider({ type: 'anthropic', apiKey: 'sk-ant-test' });
      expect(provider.info.type).toBe('anthropic');
    });

    it('should throw for unknown provider type', () => {
      expect(() =>
        createProvider({ type: 'unknown' as ProviderType, apiKey: 'test' })
      ).toThrow('Unknown provider type');
    });

    it('should throw if API key is missing', () => {
      expect(() => createProvider({ type: 'openai', apiKey: '' })).toThrow('API key is required');
    });
  });

  describe('listModels', () => {
    it('should list openai models via convenience function', async () => {
      vi.stubGlobal('fetch', mockFetch(openAIModelsResponse()));

      const models = await listModels('openai', 'sk-test');
      expect(models).toHaveLength(2);
      expect(models[0]!.id).toBe('gpt-4o');
      expect(models[0]!.provider).toBe('openai');
    });

    it('should list anthropic models via convenience function', async () => {
      vi.stubGlobal('fetch', mockFetch(anthropicModelsResponse()));

      const models = await listModels('anthropic', 'sk-ant-test');
      expect(models).toHaveLength(2);
      expect(models[0]!.id).toBe('claude-sonnet-4-5-20250929');
      expect(models[0]!.provider).toBe('anthropic');
    });
  });
});

// =============================================================================
// PROVIDER INFO IMMUTABILITY TESTS
// =============================================================================

describe('ProviderInfo immutability', () => {
  it('should not allow mutation of OpenAI info', () => {
    const info = getProvider('openai');
    expect(() => {
      (info as Record<string, unknown>).name = 'Hacked';
    }).toThrow();
  });

  it('should not allow mutation of Anthropic info', () => {
    const info = getProvider('anthropic');
    expect(() => {
      (info as Record<string, unknown>).name = 'Hacked';
    }).toThrow();
  });
});

// =============================================================================
// OPENAI PROVIDER TESTS
// =============================================================================

describe('OpenAI Provider', () => {
  describe('complete', () => {
    it('should send a chat completion request', async () => {
      const fetchMock = mockFetch(openAIChatResponse('Hello!'));
      vi.stubGlobal('fetch', fetchMock);

      const provider = createOpenAIProvider({ type: 'openai', apiKey: 'sk-test' });
      const result = await provider.complete([{ role: 'user', content: 'Hi' }]);

      expect(result.text).toBe('Hello!');
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o');
      expect(result.tokens).toEqual({ prompt: 10, completion: 5, total: 15 });
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);

      // Verify fetch was called correctly
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect(init.method).toBe('POST');
      expect(init.headers['Authorization']).toBe('Bearer sk-test');

      const body = JSON.parse(init.body as string);
      expect(body.model).toBe('gpt-4o');
      expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
    });

    it('should use custom model and options', async () => {
      vi.stubGlobal('fetch', mockFetch(openAIChatResponse('Response')));

      const provider = createOpenAIProvider({ type: 'openai', apiKey: 'sk-test' });
      await provider.complete([{ role: 'user', content: 'test' }], {
        model: 'gpt-4o-mini',
        temperature: 0.5,
        maxTokens: 100,
      });

      const body = JSON.parse((vi.mocked(fetch).mock.calls[0]![1]!.body as string));
      expect(body.model).toBe('gpt-4o-mini');
      expect(body.temperature).toBe(0.5);
      expect(body.max_tokens).toBe(100);
    });

    it('should throw on API error', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch({ error: { message: 'Invalid API key' } }, 401)
      );

      const provider = createOpenAIProvider({ type: 'openai', apiKey: 'bad-key' });
      await expect(
        provider.complete([{ role: 'user', content: 'test' }])
      ).rejects.toThrow('OpenAI API error (401)');
    });
  });

  describe('complete with custom baseUrl', () => {
    it('should use custom base URL for requests', async () => {
      const fetchMock = mockFetch(openAIChatResponse('Response'));
      vi.stubGlobal('fetch', fetchMock);

      const provider = createOpenAIProvider({
        type: 'openai',
        apiKey: 'sk-test',
        baseUrl: 'https://my-proxy.example.com',
      });
      await provider.complete([{ role: 'user', content: 'Hi' }]);

      const [url] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://my-proxy.example.com/v1/chat/completions');
    });
  });

  describe('listModels', () => {
    it('should return parsed model list', async () => {
      vi.stubGlobal('fetch', mockFetch(openAIModelsResponse()));

      const provider = createOpenAIProvider({ type: 'openai', apiKey: 'sk-test' });
      const models = await provider.listModels();

      expect(models).toHaveLength(2);
      expect(models[0]!.id).toBe('gpt-4o');
      expect(models[0]!.provider).toBe('openai');
      expect(models[0]!.createdAt).toBe(1700000000);
      expect(models[0]!.ownedBy).toBe('openai');
    });
  });

  describe('judge', () => {
    it('should return pass with reasoning', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch(
          openAIChatResponse(
            'The response correctly addresses the question.\nVERDICT: YES'
          )
        )
      );

      const provider = createOpenAIProvider({ type: 'openai', apiKey: 'sk-test' });
      const result = await provider.judge('The sky is blue.', 'Does this mention the sky?');

      expect(result.pass).toBe(true);
      expect(result.reasoning).toContain('correctly addresses');
    });

    it('should return fail with reasoning', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch(
          openAIChatResponse(
            'The response is off topic.\nVERDICT: NO'
          )
        )
      );

      const provider = createOpenAIProvider({ type: 'openai', apiKey: 'sk-test' });
      const result = await provider.judge('Bananas are yellow.', 'Does this mention the sky?');

      expect(result.pass).toBe(false);
      expect(result.reasoning).toContain('off topic');
    });
  });

  describe('similarity', () => {
    it('should return a similarity score', async () => {
      vi.stubGlobal('fetch', mockFetch(openAIChatResponse('0.85')));

      const provider = createOpenAIProvider({ type: 'openai', apiKey: 'sk-test' });
      const score = await provider.similarity('Hello world', 'Hi world');

      expect(score).toBe(0.85);
    });
  });
});

// =============================================================================
// ANTHROPIC PROVIDER TESTS
// =============================================================================

describe('Anthropic Provider', () => {
  describe('complete', () => {
    it('should send a messages request with correct headers', async () => {
      const fetchMock = mockFetch(anthropicMessageResponse('Hello!'));
      vi.stubGlobal('fetch', fetchMock);

      const provider = createAnthropicProvider({ type: 'anthropic', apiKey: 'sk-ant-test' });
      const result = await provider.complete([{ role: 'user', content: 'Hi' }]);

      expect(result.text).toBe('Hello!');
      expect(result.provider).toBe('anthropic');
      expect(result.tokens).toEqual({ prompt: 10, completion: 5, total: 15 });

      // Verify headers
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(init.headers['x-api-key']).toBe('sk-ant-test');
      expect(init.headers['anthropic-version']).toBe('2023-06-01');
    });

    it('should extract system messages into top-level system field', async () => {
      vi.stubGlobal('fetch', mockFetch(anthropicMessageResponse('Response')));

      const provider = createAnthropicProvider({ type: 'anthropic', apiKey: 'sk-ant-test' });
      await provider.complete([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' },
      ]);

      const body = JSON.parse((vi.mocked(fetch).mock.calls[0]![1]!.body as string));
      expect(body.system).toBe('You are helpful');
      expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
    });

    it('should always include max_tokens', async () => {
      vi.stubGlobal('fetch', mockFetch(anthropicMessageResponse('Response')));

      const provider = createAnthropicProvider({ type: 'anthropic', apiKey: 'sk-ant-test' });
      await provider.complete([{ role: 'user', content: 'test' }]);

      const body = JSON.parse((vi.mocked(fetch).mock.calls[0]![1]!.body as string));
      expect(body.max_tokens).toBe(4096);
    });

    it('should throw on API error', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch({ error: { message: 'Invalid API key' } }, 401)
      );

      const provider = createAnthropicProvider({ type: 'anthropic', apiKey: 'bad-key' });
      await expect(
        provider.complete([{ role: 'user', content: 'test' }])
      ).rejects.toThrow('Anthropic API error (401)');
    });
  });

  describe('complete with multiple system messages', () => {
    it('should concatenate multiple system messages', async () => {
      const fetchMock = mockFetch(anthropicMessageResponse('Response'));
      vi.stubGlobal('fetch', fetchMock);

      const provider = createAnthropicProvider({ type: 'anthropic', apiKey: 'sk-ant-test' });
      await provider.complete([
        { role: 'system', content: 'You are helpful.' },
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Hi' },
      ]);

      const body = JSON.parse((fetchMock.mock.calls[0]![1]!.body as string));
      expect(body.system).toBe('You are helpful.\n\nBe concise.');
      expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
    });
  });

  describe('complete with custom baseUrl', () => {
    it('should use custom base URL for requests', async () => {
      const fetchMock = mockFetch(anthropicMessageResponse('Response'));
      vi.stubGlobal('fetch', fetchMock);

      const provider = createAnthropicProvider({
        type: 'anthropic',
        apiKey: 'sk-ant-test',
        baseUrl: 'https://custom-proxy.example.com',
      });
      await provider.complete([{ role: 'user', content: 'Hi' }]);

      const [url] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://custom-proxy.example.com/v1/messages');
    });
  });

  describe('listModels', () => {
    it('should return parsed model list', async () => {
      vi.stubGlobal('fetch', mockFetch(anthropicModelsResponse()));

      const provider = createAnthropicProvider({ type: 'anthropic', apiKey: 'sk-ant-test' });
      const models = await provider.listModels();

      expect(models).toHaveLength(2);
      expect(models[0]!.id).toBe('claude-sonnet-4-5-20250929');
      expect(models[0]!.provider).toBe('anthropic');
    });
  });

  describe('judge', () => {
    it('should return pass with reasoning', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch(
          anthropicMessageResponse(
            'The response is relevant.\nVERDICT: YES'
          )
        )
      );

      const provider = createAnthropicProvider({ type: 'anthropic', apiKey: 'sk-ant-test' });
      const result = await provider.judge('The sky is blue.', 'Does this mention the sky?');

      expect(result.pass).toBe(true);
      expect(result.reasoning).toContain('relevant');
    });

    it('should return fail with reasoning', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch(
          anthropicMessageResponse(
            'The response does not match.\nVERDICT: NO'
          )
        )
      );

      const provider = createAnthropicProvider({ type: 'anthropic', apiKey: 'sk-ant-test' });
      const result = await provider.judge('Bananas are yellow.', 'Does this mention the sky?');

      expect(result.pass).toBe(false);
      expect(result.reasoning).toContain('does not match');
    });
  });

  describe('similarity', () => {
    it('should return a similarity score', async () => {
      vi.stubGlobal('fetch', mockFetch(anthropicMessageResponse('0.92')));

      const provider = createAnthropicProvider({ type: 'anthropic', apiKey: 'sk-ant-test' });
      const score = await provider.similarity('Hello world', 'Hi world');

      expect(score).toBe(0.92);
    });
  });
});

// =============================================================================
// BASE UTILITIES TESTS
// =============================================================================

describe('Base Utilities', () => {
  describe('parseJudgeResponse', () => {
    it('should detect VERDICT: YES', () => {
      const result = parseJudgeResponse('Good response.\nVERDICT: YES');
      expect(result.pass).toBe(true);
      expect(result.reasoning).toBe('Good response.');
    });

    it('should detect VERDICT: NO', () => {
      const result = parseJudgeResponse('Bad response.\nVERDICT: NO');
      expect(result.pass).toBe(false);
      expect(result.reasoning).toBe('Bad response.');
    });

    it('should default to fail when no verdict found', () => {
      const result = parseJudgeResponse('Unclear answer.');
      expect(result.pass).toBe(false);
    });
  });

  describe('parseSimilarityResponse', () => {
    it('should parse a valid score', () => {
      expect(parseSimilarityResponse('0.75')).toBe(0.75);
    });

    it('should clamp to 0-1 range', () => {
      expect(parseSimilarityResponse('1.5')).toBe(1);
      expect(parseSimilarityResponse('-0.5')).toBe(0);
    });

    it('should return 0 for invalid text', () => {
      expect(parseSimilarityResponse('not a number')).toBe(0);
    });
  });

  describe('buildJudgePrompt', () => {
    it('should include response and question', () => {
      const prompt = buildJudgePrompt('The sky is blue.', 'Is this about weather?');
      expect(prompt).toContain('The sky is blue.');
      expect(prompt).toContain('Is this about weather?');
      expect(prompt).toContain('VERDICT');
    });
  });

  describe('buildSimilarityPrompt', () => {
    it('should include both texts', () => {
      const prompt = buildSimilarityPrompt('Hello', 'Hi');
      expect(prompt).toContain('Hello');
      expect(prompt).toContain('Hi');
      expect(prompt).toContain('0.0 to 1.0');
    });
  });

  describe('toLLMProvider', () => {
    it('should adapt complete() to single-prompt interface', async () => {
      vi.stubGlobal('fetch', mockFetch(openAIChatResponse('Adapted!')));

      const instance = createOpenAIProvider({ type: 'openai', apiKey: 'sk-test' });
      const llmProvider = toLLMProvider(instance);

      const result = await llmProvider.complete('Test prompt');
      expect(result.text).toBe('Adapted!');
      expect(result.model).toBe('gpt-4o');
      expect(result.tokens).toBeDefined();
    });

    it('should delegate judge()', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch(openAIChatResponse('Looks good.\nVERDICT: YES'))
      );

      const instance = createOpenAIProvider({ type: 'openai', apiKey: 'sk-test' });
      const llmProvider = toLLMProvider(instance);

      const result = await llmProvider.judge('Response text', 'Is this good?');
      expect(result.pass).toBe(true);
    });

    it('should delegate similarity()', async () => {
      vi.stubGlobal('fetch', mockFetch(openAIChatResponse('0.9')));

      const instance = createOpenAIProvider({ type: 'openai', apiKey: 'sk-test' });
      const llmProvider = toLLMProvider(instance);

      const score = await llmProvider.similarity('A', 'B');
      expect(score).toBe(0.9);
    });
  });
});

// =============================================================================
// RUN PROMPT TESTS
// =============================================================================

describe('runPrompt', () => {
  it('should render template and send to LLM', async () => {
    vi.stubGlobal('fetch', mockFetch(openAIChatResponse('Great comedy: The Hangover')));

    const result = await runPrompt({
      template: 'Recommend a {{genre}} movie.',
      variables: { genre: 'Comedy' },
      provider: { type: 'openai', apiKey: 'sk-test' },
    });

    expect(result.renderedPrompt).toBe('Recommend a Comedy movie.');
    expect(result.response.text).toBe('Great comedy: The Hangover');
    expect(result.response.provider).toBe('openai');
  });

  it('should include system message when provided', async () => {
    const fetchMock = mockFetch(openAIChatResponse('Response'));
    vi.stubGlobal('fetch', fetchMock);

    await runPrompt({
      template: 'Hello {{name}}',
      variables: { name: 'World' },
      provider: { type: 'openai', apiKey: 'sk-test' },
      systemMessage: 'You are a helpful assistant.',
    });

    const body = JSON.parse((fetchMock.mock.calls[0]![1]!.body as string));
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toBe('You are a helpful assistant.');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toBe('Hello World');
  });

  it('should throw on template parse error', async () => {
    await expect(
      runPrompt({
        template: '[#IF {{x}} #unknown_op]broken[END IF',
        variables: {},
        provider: { type: 'openai', apiKey: 'sk-test' },
      })
    ).rejects.toThrow('Parse error');
  });

  it('should handle conditionals in the template', async () => {
    vi.stubGlobal('fetch', mockFetch(openAIChatResponse('Response')));

    const result = await runPrompt({
      template:
        '[#IF {{premium}} #equals(true)]Premium content[ELSE]Free content[END IF]',
      variables: { premium: 'false' },
      provider: { type: 'openai', apiKey: 'sk-test' },
    });

    expect(result.renderedPrompt).toContain('Free content');
  });

  it('should work with anthropic provider', async () => {
    vi.stubGlobal('fetch', mockFetch(anthropicMessageResponse('Claude response')));

    const result = await runPrompt({
      template: 'Hello {{name}}',
      variables: { name: 'Claude' },
      provider: { type: 'anthropic', apiKey: 'sk-ant-test' },
    });

    expect(result.renderedPrompt).toBe('Hello Claude');
    expect(result.response.text).toBe('Claude response');
    expect(result.response.provider).toBe('anthropic');
  });
});
