/**
 * @fileoverview Google Gemini / Vertex AI provider implementation
 *
 * Implements AIProviderInstance for Google's Gemini API:
 * - POST /v1beta/models/{model}:generateContent for completions
 * - GET /v1beta/models for model listing
 *
 * Supports both Gemini API (generativelanguage.googleapis.com) and
 * Vertex AI (via custom baseUrl).
 */

import type {
  AIProviderInstance,
  CompletionResponse,
  ModelInfo,
  ProviderConfig,
  ProviderInfo,
  ToolCall,
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

export const GOOGLE_INFO: ProviderInfo = Object.freeze({
  type: 'google',
  name: 'Google Gemini',
  baseUrl: 'https://generativelanguage.googleapis.com',
  defaultModel: 'gemini-2.5-flash',
  envKeys: Object.freeze(['GOOGLE_API_KEY', 'GEMINI_API_KEY', 'ECHO_API_KEY']),
}) as ProviderInfo;

// =============================================================================
// RESPONSE TYPES
// =============================================================================

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string;
        functionCall?: { name: string; args: Record<string, unknown> };
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  modelVersion?: string;
}

interface GeminiModelsResponse {
  models: Array<{
    name: string;
    displayName: string;
    description?: string;
  }>;
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create a Google Gemini provider instance.
 *
 * @param config - Provider configuration with API key
 * @returns AIProviderInstance for Google Gemini
 */
export function createGoogleProvider(config: ProviderConfig): AIProviderInstance {
  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl ?? GOOGLE_INFO.baseUrl;
  const defaultModel = config.model ?? GOOGLE_INFO.defaultModel;
  const timeout = config.timeout ?? 30000;

  if (!apiKey) {
    throw new Error(
      'Google API key is required. Set GOOGLE_API_KEY environment variable or pass it in config.'
    );
  }

  const instance: AIProviderInstance = {
    info: GOOGLE_INFO,

    async complete(messages, options) {
      const model = options?.model ?? defaultModel;
      const start = Date.now();

      // Convert messages to Gemini format
      // Gemini: system instruction is separate, other roles map to user/model
      const systemParts: string[] = [];
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      for (const m of messages) {
        const text = typeof m.content === 'string'
          ? m.content
          : m.content.map(b => b.type === 'text' ? b.text : '').join('');

        if (m.role === 'system') {
          systemParts.push(text);
        } else {
          contents.push({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text }],
          });
        }
      }

      const body: Record<string, unknown> = { contents };

      if (systemParts.length > 0) {
        body.systemInstruction = { parts: [{ text: systemParts.join('\n\n') }] };
      }

      const generationConfig: Record<string, unknown> = {};
      if (options?.temperature !== undefined) {
        generationConfig.temperature = options.temperature;
      }
      if (options?.maxTokens !== undefined) {
        generationConfig.maxOutputTokens = options.maxTokens;
      }
      if (Object.keys(generationConfig).length > 0) {
        body.generationConfig = generationConfig;
      }

      // Tools in Gemini format
      if (options?.tools && options.tools.length > 0) {
        body.tools = [{
          functionDeclarations: options.tools.map(t => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          })),
        }];
      }

      const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        timeout
      );

      if (!response.ok) {
        throw new Error(await extractApiError(response, 'Google Gemini'));
      }

      const data = (await response.json()) as GeminiResponse;
      const parts = data.candidates?.[0]?.content?.parts ?? [];

      const text = parts
        .filter(p => p.text !== undefined)
        .map(p => p.text!)
        .join('');

      // Parse function calls
      let toolCalls: ToolCall[] | undefined;
      const fnCalls = parts.filter(p => p.functionCall);
      if (fnCalls.length > 0) {
        toolCalls = fnCalls.map((p, i) => ({
          id: `call_${i}`,
          name: p.functionCall!.name,
          arguments: p.functionCall!.args,
        }));
      }

      return {
        text,
        toolCalls,
        tokens: data.usageMetadata
          ? {
              prompt: data.usageMetadata.promptTokenCount,
              completion: data.usageMetadata.candidatesTokenCount,
              total: data.usageMetadata.totalTokenCount,
            }
          : undefined,
        latencyMs: Date.now() - start,
        model: data.modelVersion ?? model,
        provider: 'google',
      } satisfies CompletionResponse;
    },

    async listModels() {
      const url = `${baseUrl}/v1beta/models?key=${apiKey}`;
      const response = await fetchWithTimeout(
        url,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        timeout
      );

      if (!response.ok) {
        throw new Error(await extractApiError(response, 'Google Gemini'));
      }

      const data = (await response.json()) as GeminiModelsResponse;

      return data.models.map(
        (m): ModelInfo => ({
          id: m.name.replace('models/', ''),
          provider: 'google',
          ownedBy: m.displayName,
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
