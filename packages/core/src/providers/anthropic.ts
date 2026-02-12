/**
 * @fileoverview Anthropic provider implementation
 *
 * Implements AIProviderInstance for Anthropic's API:
 * - POST /v1/messages for completions (x-api-key auth, system field, max_tokens required)
 * - GET /v1/models for model listing
 * - Judge and similarity via shared prompts
 */

import type {
  AIProviderInstance,
  CompletionResponse,
  ModelInfo,
  ProviderConfig,
  ProviderInfo,
} from './types.js';
import {
  fetchWithTimeout,
  extractApiError,
  buildJudgePrompt,
  parseJudgeResponse,
  buildSimilarityPrompt,
  parseSimilarityResponse,
} from './base.js';

// =============================================================================
// PROVIDER INFO
// =============================================================================

export const ANTHROPIC_INFO: ProviderInfo = Object.freeze({
  type: 'anthropic',
  name: 'Anthropic',
  baseUrl: 'https://api.anthropic.com',
  defaultModel: 'claude-sonnet-4-5-20250929',
  envKeys: Object.freeze(['ANTHROPIC_API_KEY', 'ECHO_API_KEY']),
}) as ProviderInfo;

// =============================================================================
// RESPONSE TYPES
// =============================================================================

interface AnthropicMessageResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  model: string;
}

interface AnthropicModelsResponse {
  data: Array<{
    id: string;
    created_at: string;
    display_name: string;
  }>;
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create an Anthropic provider instance.
 *
 * @param config - Provider configuration with API key
 * @returns AIProviderInstance for Anthropic
 */
export function createAnthropicProvider(config: ProviderConfig): AIProviderInstance {
  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl ?? ANTHROPIC_INFO.baseUrl;
  const defaultModel = config.model ?? ANTHROPIC_INFO.defaultModel;
  const timeout = config.timeout ?? 30000;

  if (!apiKey) {
    throw new Error(
      'Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or pass it in config.'
    );
  }

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  const instance: AIProviderInstance = {
    info: ANTHROPIC_INFO,

    async complete(messages, options) {
      const model = options?.model ?? defaultModel;
      const maxTokens = options?.maxTokens ?? 4096;
      const start = Date.now();

      // Anthropic: system messages go in top-level `system` field.
      // Multiple system messages are concatenated (separated by newlines).
      const systemParts: string[] = [];
      const userMessages: Array<{ role: string; content: string | unknown[] }> = [];

      for (const m of messages) {
        if (m.role === 'system') {
          // System messages are always strings
          systemParts.push(typeof m.content === 'string' ? m.content : '');
        } else if (typeof m.content === 'string') {
          userMessages.push({ role: m.role, content: m.content });
        } else {
          // Convert ContentBlock[] to Anthropic's format
          const anthropicBlocks = m.content.map((block) => {
            if (block.type === 'text') {
              return { type: 'text', text: block.text };
            }
            // Convert image_url to Anthropic's image source format
            const url = block.image_url.url;
            const match = url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              return {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: match[1],
                  data: match[2],
                },
              };
            }
            // URL-based image
            return {
              type: 'image',
              source: { type: 'url', url },
            };
          });
          userMessages.push({ role: m.role, content: anthropicBlocks });
        }
      }

      const systemMessage = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;

      const body: Record<string, unknown> = {
        model,
        messages: userMessages,
        max_tokens: maxTokens,
      };
      if (systemMessage) {
        body.system = systemMessage;
      }
      if (options?.temperature !== undefined) {
        body.temperature = options.temperature;
      }

      const response = await fetchWithTimeout(
        `${baseUrl}/v1/messages`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        },
        timeout
      );

      if (!response.ok) {
        throw new Error(await extractApiError(response, 'Anthropic'));
      }

      const data = (await response.json()) as AnthropicMessageResponse;
      const text = data.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('');

      return {
        text,
        tokens: {
          prompt: data.usage.input_tokens,
          completion: data.usage.output_tokens,
          total: data.usage.input_tokens + data.usage.output_tokens,
        },
        latencyMs: Date.now() - start,
        model: data.model ?? model,
        provider: 'anthropic',
      } satisfies CompletionResponse;
    },

    async listModels() {
      const response = await fetchWithTimeout(
        `${baseUrl}/v1/models`,
        { method: 'GET', headers },
        timeout
      );

      if (!response.ok) {
        throw new Error(await extractApiError(response, 'Anthropic'));
      }

      const data = (await response.json()) as AnthropicModelsResponse;

      return data.data.map(
        (m): ModelInfo => ({
          id: m.id,
          provider: 'anthropic',
          createdAt: m.created_at ? new Date(m.created_at).getTime() / 1000 : undefined,
          ownedBy: m.display_name,
        })
      );
    },

    async judge(responseText, question) {
      const prompt = buildJudgePrompt(responseText, question);
      const result = await instance.complete([{ role: 'user', content: prompt }]);
      return parseJudgeResponse(result.text);
    },

    async similarity(textA, textB) {
      const prompt = buildSimilarityPrompt(textA, textB);
      const result = await instance.complete([{ role: 'user', content: prompt }]);
      return parseSimilarityResponse(result.text);
    },
  };

  return instance;
}
