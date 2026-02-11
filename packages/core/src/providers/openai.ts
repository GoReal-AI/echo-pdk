/**
 * @fileoverview OpenAI provider implementation
 *
 * Implements AIProviderInstance for OpenAI's API:
 * - POST /v1/chat/completions for completions
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

export const OPENAI_INFO: ProviderInfo = Object.freeze({
  type: 'openai',
  name: 'OpenAI',
  baseUrl: 'https://api.openai.com',
  defaultModel: 'gpt-4o',
  envKeys: Object.freeze(['OPENAI_API_KEY', 'ECHO_API_KEY']),
}) as ProviderInfo;

// =============================================================================
// RESPONSE TYPES (minimal, just what we need)
// =============================================================================

interface OpenAIChatResponse {
  choices: Array<{
    message: { content: string | null };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

interface OpenAIModelsResponse {
  data: Array<{
    id: string;
    created: number;
    owned_by: string;
  }>;
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create an OpenAI provider instance.
 *
 * @param config - Provider configuration with API key
 * @returns AIProviderInstance for OpenAI
 */
export function createOpenAIProvider(config: ProviderConfig): AIProviderInstance {
  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl ?? OPENAI_INFO.baseUrl;
  const defaultModel = config.model ?? OPENAI_INFO.defaultModel;
  const timeout = config.timeout ?? 30000;

  if (!apiKey) {
    throw new Error(
      'OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it in config.'
    );
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  const instance: AIProviderInstance = {
    info: OPENAI_INFO,

    async complete(messages, options) {
      const model = options?.model ?? defaultModel;
      const start = Date.now();

      const body: Record<string, unknown> = {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      };
      if (options?.temperature !== undefined) {
        body.temperature = options.temperature;
      }
      if (options?.maxTokens !== undefined) {
        body.max_tokens = options.maxTokens;
      }

      const response = await fetchWithTimeout(
        `${baseUrl}/v1/chat/completions`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        },
        timeout
      );

      if (!response.ok) {
        throw new Error(await extractApiError(response, 'OpenAI'));
      }

      const data = (await response.json()) as OpenAIChatResponse;
      const text = data.choices[0]?.message?.content ?? '';

      return {
        text,
        tokens: data.usage
          ? {
              prompt: data.usage.prompt_tokens,
              completion: data.usage.completion_tokens,
              total: data.usage.total_tokens,
            }
          : undefined,
        latencyMs: Date.now() - start,
        model: data.model ?? model,
        provider: 'openai',
      } satisfies CompletionResponse;
    },

    async listModels() {
      const response = await fetchWithTimeout(
        `${baseUrl}/v1/models`,
        { method: 'GET', headers },
        timeout
      );

      if (!response.ok) {
        throw new Error(await extractApiError(response, 'OpenAI'));
      }

      const data = (await response.json()) as OpenAIModelsResponse;

      return data.data.map(
        (m): ModelInfo => ({
          id: m.id,
          provider: 'openai',
          createdAt: m.created,
          ownedBy: m.owned_by,
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
