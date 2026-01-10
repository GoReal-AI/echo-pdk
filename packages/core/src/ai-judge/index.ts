/**
 * @fileoverview AI Judge - LLM-based condition evaluation
 *
 * This module handles the #ai_judge operator which queries an LLM
 * to evaluate boolean conditions.
 *
 * FEATURES:
 * - Provider abstraction for different backends (OpenAI, Anthropic)
 * - Automatic caching with TTL to avoid redundant API calls
 * - Structured prompts for consistent yes/no answers
 * - Graceful error handling
 *
 * API KEY CONFIGURATION:
 * The API key can be provided in three ways (in priority order):
 * 1. Programmatic: createEcho({ aiProvider: { apiKey: '...' } })
 * 2. Environment: ECHO_API_KEY or OPENAI_API_KEY
 * 3. Config file: echo.config.yaml (aiProvider.apiKey)
 */

import type { AIProviderConfig } from '../types.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * AI Provider interface for evaluating boolean conditions.
 */
export interface AIProvider {
  /**
   * Evaluate a boolean question about a value.
   *
   * @param value - The value to evaluate
   * @param question - The yes/no question to ask
   * @returns true or false based on the AI's response
   */
  evaluate(value: unknown, question: string): Promise<boolean>;
}

/**
 * Cache entry for AI judge results.
 */
interface CacheEntry {
  result: boolean;
  timestamp: number;
}

/**
 * OpenAI chat completion message.
 */
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * OpenAI chat completion response (minimal type for our needs).
 */
interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
}

// =============================================================================
// OPENAI PROVIDER
// =============================================================================

/**
 * Create an OpenAI-based AI provider.
 *
 * @param config - Configuration with API key and model
 * @returns AIProvider using OpenAI
 *
 * @example
 * ```typescript
 * const provider = createOpenAIProvider({
 *   type: 'openai',
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'gpt-4o-mini',
 * });
 *
 * const result = await provider.evaluate(
 *   'This is a family-friendly movie.',
 *   'Is this content appropriate for children?'
 * );
 * ```
 */
export function createOpenAIProvider(config: AIProviderConfig): AIProvider {
  const apiKey = config.apiKey;
  const model = config.model ?? 'gpt-4o-mini';
  const timeout = config.timeout ?? 30000;

  if (!apiKey) {
    throw new Error(
      'OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it in config.'
    );
  }

  return {
    async evaluate(value: unknown, question: string): Promise<boolean> {
      const prompt = buildPrompt(value, question);

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content:
            'You are a precise yes/no evaluator. Answer ONLY with "yes" or "no" (lowercase, no punctuation). Do not explain or elaborate.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ];

      try {
        const response = await callOpenAI(apiKey, model, messages, timeout);
        const answer = response.choices[0]?.message?.content?.trim().toLowerCase();

        if (answer === 'yes') {
          return true;
        }
        if (answer === 'no') {
          return false;
        }

        // Unexpected response - try to interpret
        if (answer?.includes('yes')) {
          return true;
        }
        if (answer?.includes('no')) {
          return false;
        }

        // Default to false for ambiguous responses
        console.warn(`AI Judge returned unexpected response: "${answer}". Defaulting to false.`);
        return false;
      } catch (error) {
        // Re-throw with more context
        if (error instanceof Error) {
          throw new Error(`AI Judge evaluation failed: ${error.message}`);
        }
        throw new Error('AI Judge evaluation failed: Unknown error');
      }
    },
  };
}

/**
 * Call the OpenAI Chat Completions API.
 */
async function callOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  timeout: number
): Promise<ChatCompletionResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 10,
        temperature: 0, // Deterministic responses
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
    }

    return (await response.json()) as ChatCompletionResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Build the prompt for the AI judge.
 *
 * The prompt is designed to get a clear yes/no answer.
 *
 * @param value - The value to evaluate
 * @param question - The question to ask
 * @returns Formatted prompt string
 */
export function buildPrompt(value: unknown, question: string): string {
  const valueStr = typeof value === 'string' ? value : JSON.stringify(value, null, 2);

  return `Given the following value:
---
${valueStr}
---

Answer with ONLY "yes" or "no":
${question}`;
}

// =============================================================================
// AI JUDGE FACTORY
// =============================================================================

/**
 * Create an AI Judge instance with the given configuration.
 *
 * @param config - AI provider configuration
 * @returns An AIProvider implementation
 *
 * @example
 * ```typescript
 * const judge = createAIJudge({
 *   type: 'openai',
 *   apiKey: process.env.OPENAI_API_KEY,
 * });
 *
 * const isAppropriate = await judge.evaluate(content, 'Is this safe for work?');
 * ```
 */
export function createAIJudge(config: AIProviderConfig): AIProvider {
  switch (config.type) {
    case 'openai':
      return createOpenAIProvider(config);

    case 'anthropic':
      // TODO: Implement Anthropic provider
      throw new Error(
        'Anthropic provider not yet implemented. Use OpenAI for now.'
      );

    default:
      throw new Error(`Unknown AI provider type: ${config.type}`);
  }
}

// =============================================================================
// CACHING
// =============================================================================

/** Module-level cache for AI judge results */
const cache = new Map<string, CacheEntry>();

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Create a cache key for a value/question pair.
 *
 * @param value - The value being evaluated
 * @param question - The question asked
 * @returns A string key for the cache
 */
export function createCacheKey(value: unknown, question: string): string {
  return JSON.stringify({ value, question });
}

/**
 * Get a cached result if available and not expired.
 *
 * @param key - The cache key
 * @returns The cached result or undefined if not found/expired
 */
export function getCached(key: string): boolean | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;

  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return undefined;
  }

  return entry.result;
}

/**
 * Store a result in the cache.
 *
 * @param key - The cache key
 * @param result - The result to cache
 */
export function setCache(key: string, result: boolean): void {
  cache.set(key, {
    result,
    timestamp: Date.now(),
  });
}

/**
 * Clear the entire cache.
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get the current cache size (for testing/debugging).
 */
export function getCacheSize(): number {
  return cache.size;
}

/**
 * Wrap an AI provider with caching.
 *
 * @param provider - The AI provider to wrap
 * @returns A caching wrapper around the provider
 *
 * @example
 * ```typescript
 * const provider = createOpenAIProvider(config);
 * const cachedProvider = withCache(provider);
 *
 * // First call hits the API
 * const result1 = await cachedProvider.evaluate(value, question);
 *
 * // Second call with same inputs returns cached result
 * const result2 = await cachedProvider.evaluate(value, question);
 * ```
 */
export function withCache(provider: AIProvider): AIProvider {
  return {
    async evaluate(value: unknown, question: string): Promise<boolean> {
      const key = createCacheKey(value, question);

      // Check cache first
      const cached = getCached(key);
      if (cached !== undefined) {
        return cached;
      }

      // Call the provider
      const result = await provider.evaluate(value, question);

      // Cache the result
      setCache(key, result);

      return result;
    },
  };
}
