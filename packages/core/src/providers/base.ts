/**
 * @fileoverview Shared provider utilities
 *
 * Common functions used by all provider implementations:
 * - HTTP helpers (fetchWithTimeout, extractApiError)
 * - Judge/similarity prompt builders and parsers
 * - toLLMProvider adapter for backward compatibility with eval system
 */

import type { AIProviderInstance } from './types.js';
import type { LLMProvider, LLMResponse } from '../eval/types.js';

// =============================================================================
// HTTP HELPERS
// =============================================================================

/**
 * Fetch with an AbortController-based timeout.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract a human-readable error message from an API response.
 */
export async function extractApiError(
  response: Response,
  providerName: string
): Promise<string> {
  const body = await response.text();
  return `${providerName} API error (${response.status}): ${body}`;
}

// =============================================================================
// JUDGE PROMPTS
// =============================================================================

/**
 * Build the prompt for LLM-as-judge evaluation.
 */
export function buildJudgePrompt(response: string, question: string): string {
  return `You are evaluating an LLM response. First provide a brief reasoning (1-2 sentences), then on a new line answer exactly "VERDICT: YES" or "VERDICT: NO".

Response to evaluate:
${response}

Question: ${question}`;
}

/**
 * Parse a judge response into pass/fail + reasoning.
 */
export function parseJudgeResponse(text: string): {
  pass: boolean;
  reasoning: string;
} {
  const trimmed = text.trim();
  const pass = trimmed.toUpperCase().includes('VERDICT: YES');
  const reasoning = trimmed
    .replace(/\n?\s*VERDICT:\s*(YES|NO)\s*$/i, '')
    .trim();
  return { pass, reasoning };
}

// =============================================================================
// SIMILARITY PROMPTS
// =============================================================================

/**
 * Build the prompt for semantic similarity scoring.
 */
export function buildSimilarityPrompt(textA: string, textB: string): string {
  return `Rate the semantic similarity between these two texts on a scale of 0.0 to 1.0. Answer with only a number.

Text A:
${textA}

Text B:
${textB}`;
}

/**
 * Parse a similarity response into a 0.0-1.0 score.
 */
export function parseSimilarityResponse(text: string): number {
  const score = parseFloat(text.trim());
  return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
}

// =============================================================================
// ADAPTER
// =============================================================================

/**
 * Adapt an AIProviderInstance to the eval system's LLMProvider interface.
 *
 * The eval runner uses LLMProvider with `complete(prompt, model?)`.
 * This bridges the gap so the new provider system works with existing eval code.
 */
export function toLLMProvider(instance: AIProviderInstance): LLMProvider {
  return {
    async complete(prompt: string, model?: string): Promise<LLMResponse> {
      const response = await instance.complete(
        [{ role: 'user', content: prompt }],
        { model }
      );
      return {
        text: response.text,
        tokens: response.tokens,
        latencyMs: response.latencyMs,
        model: response.model,
      };
    },

    async judge(
      response: string,
      question: string
    ): Promise<{ pass: boolean; reasoning: string }> {
      return instance.judge(response, question);
    },

    async similarity(textA: string, textB: string): Promise<number> {
      return instance.similarity(textA, textB);
    },
  };
}
