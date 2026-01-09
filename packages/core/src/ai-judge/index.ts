/**
 * @fileoverview AI Judge - LLM-based condition evaluation
 *
 * This module handles the #ai_judge operator which queries an LLM
 * to evaluate boolean conditions.
 *
 * IMPLEMENTATION GUIDE:
 *
 * 1. PROVIDER ABSTRACTION
 *    Create an interface for AI providers that can be implemented
 *    for different backends (OpenAI, Anthropic, etc.)
 *
 * 2. CACHING
 *    Cache results to avoid redundant API calls.
 *    Cache key = hash(value + question)
 *
 * 3. PROMPT ENGINEERING
 *    The prompt must be carefully designed to get consistent yes/no answers.
 *
 * 4. ERROR HANDLING
 *    Handle API errors, timeouts, and rate limits gracefully.
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

// =============================================================================
// AI JUDGE IMPLEMENTATION
// =============================================================================

/**
 * Create an AI Judge instance with the given configuration.
 *
 * @param config - AI provider configuration
 * @returns An AIProvider implementation
 */
export function createAIJudge(_config: AIProviderConfig): AIProvider {
  // TODO: Implement AI provider based on config.type
  //
  // IMPLEMENTATION STEPS:
  //
  // 1. CREATE PROVIDER
  //    switch (config.type) {
  //      case 'openai':
  //        return createOpenAIProvider(config);
  //      case 'anthropic':
  //        return createAnthropicProvider(config);
  //      default:
  //        throw new Error(`Unknown AI provider: ${config.type}`);
  //    }
  //
  // 2. ADD CACHING LAYER
  //    Wrap the provider with caching:
  //    return withCache(provider);

  throw new Error('AI Judge not implemented');
}

// =============================================================================
// OPENAI PROVIDER (MVP)
// =============================================================================

/**
 * Create an OpenAI-based AI provider.
 *
 * @param config - Configuration with API key and model
 * @returns AIProvider using OpenAI
 */
export function createOpenAIProvider(_config: AIProviderConfig): AIProvider {
  // TODO: Implement OpenAI provider
  //
  // IMPLEMENTATION:
  //
  // import OpenAI from 'openai';
  //
  // const client = new OpenAI({ apiKey: config.apiKey });
  //
  // return {
  //   async evaluate(value: unknown, question: string): Promise<boolean> {
  //     const prompt = buildPrompt(value, question);
  //
  //     const response = await client.chat.completions.create({
  //       model: config.model || 'gpt-4o-mini',
  //       messages: [{ role: 'user', content: prompt }],
  //       max_tokens: 10,
  //       temperature: 0, // Deterministic
  //     });
  //
  //     const answer = response.choices[0]?.message?.content?.trim().toLowerCase();
  //     return answer === 'yes';
  //   }
  // };

  throw new Error('OpenAI provider not implemented');
}

/**
 * Build the prompt for the AI judge.
 *
 * The prompt is designed to get a clear yes/no answer.
 */
export function buildPrompt(value: unknown, question: string): string {
  const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

  return `Given the following value:
---
${valueStr}
---

Answer with ONLY "yes" or "no" (nothing else):
${question}`;
}

// =============================================================================
// CACHING
// =============================================================================

/** Cache for AI judge results */
const cache = new Map<string, CacheEntry>();

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Create a cache key for a value/question pair.
 */
export function createCacheKey(value: unknown, question: string): string {
  return JSON.stringify({ value, question });
}

/**
 * Get a cached result if available and not expired.
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
 */
export function setCache(key: string, result: boolean): void {
  cache.set(key, {
    result,
    timestamp: Date.now(),
  });
}

/**
 * Clear the cache.
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Wrap an AI provider with caching.
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

// =============================================================================
// IMPLEMENTATION NOTES
// =============================================================================

/*
NEXT STEPS TO IMPLEMENT:

1. OPENAI INTEGRATION
   - Import the OpenAI package
   - Implement createOpenAIProvider
   - Handle API errors and rate limits
   - Add timeout handling

2. ANTHROPIC INTEGRATION (FUTURE)
   - Similar to OpenAI but with Claude API
   - Use the @anthropic-ai/sdk package

3. PROMPT OPTIMIZATION
   - Test the prompt with various inputs
   - Handle edge cases (empty values, very long values)
   - Consider adding examples for consistency

4. ADVANCED CACHING
   - Make cache configurable
   - Support different cache backends (memory, Redis)
   - Per-render cache for consistency

5. TESTS
   Create ai-judge.test.ts with tests for:
   - Prompt building
   - Caching behavior
   - Response parsing
   - Error handling
*/
