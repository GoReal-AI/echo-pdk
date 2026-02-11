/**
 * @fileoverview Assertion implementations for eval tests
 *
 * Each assertion takes a text output and returns a pass/fail result.
 * Assertions are organized by category:
 * - Text assertions (contains, equals, matches, etc.)
 * - Structural assertions (json_valid, json_schema)
 * - AI/Semantic assertions (llm_judge, similar_to, sentiment)
 * - Performance assertions (latency, token_count, cost)
 */

import type { Assertion, AssertionResult, LLMProvider, LLMResponse } from './types.js';

// =============================================================================
// ASSERTION RUNNER
// =============================================================================

/**
 * Context passed to assertion handlers.
 */
export interface AssertionContext {
  /** The text to assert against */
  text: string;
  /** LLM response metadata (for performance assertions) */
  llmResponse?: LLMResponse;
  /** LLM provider for AI assertions */
  llmProvider?: LLMProvider;
  /** Function to load a dataset's golden response */
  loadGolden?: (datasetName: string) => Promise<string | undefined>;
}

/**
 * Run a single assertion against the given context.
 */
export async function runAssertion(
  assertion: Assertion,
  ctx: AssertionContext
): Promise<AssertionResult> {
  // Extract the operator (first key of the assertion object)
  const entries = Object.entries(assertion);
  if (entries.length === 0) {
    return { operator: 'unknown', status: 'error', message: 'Empty assertion' };
  }

  const [operator, value] = entries[0] as [string, unknown];
  const handler = assertionHandlers[operator];

  if (!handler) {
    return {
      operator,
      status: 'error',
      message: `Unknown assertion operator: ${operator}`,
    };
  }

  try {
    return await handler(value, ctx);
  } catch (err) {
    return {
      operator,
      status: 'error',
      message: `Assertion error: ${(err as Error).message}`,
    };
  }
}

/**
 * Run multiple assertions against the given context.
 */
export async function runAssertions(
  assertions: Assertion[],
  ctx: AssertionContext
): Promise<AssertionResult[]> {
  const results: AssertionResult[] = [];
  for (const assertion of assertions) {
    results.push(await runAssertion(assertion, ctx));
  }
  return results;
}

// =============================================================================
// ASSERTION HANDLER REGISTRY
// =============================================================================

type AssertionHandler = (
  value: unknown,
  ctx: AssertionContext
) => Promise<AssertionResult>;

const assertionHandlers: Record<string, AssertionHandler> = {
  // Text assertions
  contains: async (value, ctx) => {
    const expected = String(value);
    const pass = ctx.text.includes(expected);
    return {
      operator: 'contains',
      status: pass ? 'pass' : 'fail',
      expected,
      actual: pass ? undefined : truncate(ctx.text, 100),
      message: pass ? undefined : `Expected output to contain "${expected}"`,
    };
  },

  not_contains: async (value, ctx) => {
    const expected = String(value);
    const pass = !ctx.text.includes(expected);
    return {
      operator: 'not_contains',
      status: pass ? 'pass' : 'fail',
      expected: `not "${expected}"`,
      message: pass ? undefined : `Expected output NOT to contain "${expected}"`,
    };
  },

  equals: async (value, ctx) => {
    const expected = String(value);
    const pass = ctx.text.trim() === expected.trim();
    return {
      operator: 'equals',
      status: pass ? 'pass' : 'fail',
      expected,
      actual: pass ? undefined : truncate(ctx.text, 100),
      message: pass ? undefined : 'Output does not match expected text',
    };
  },

  matches: async (value, ctx) => {
    const pattern = String(value);
    const regex = new RegExp(pattern);
    const pass = regex.test(ctx.text);
    return {
      operator: 'matches',
      status: pass ? 'pass' : 'fail',
      expected: pattern,
      message: pass ? undefined : `Output does not match pattern: ${pattern}`,
    };
  },

  starts_with: async (value, ctx) => {
    const expected = String(value);
    const pass = ctx.text.trimStart().startsWith(expected);
    return {
      operator: 'starts_with',
      status: pass ? 'pass' : 'fail',
      expected,
      message: pass ? undefined : `Expected output to start with "${expected}"`,
    };
  },

  ends_with: async (value, ctx) => {
    const expected = String(value);
    const pass = ctx.text.trimEnd().endsWith(expected);
    return {
      operator: 'ends_with',
      status: pass ? 'pass' : 'fail',
      expected,
      message: pass ? undefined : `Expected output to end with "${expected}"`,
    };
  },

  length: async (value, ctx) => {
    const opts = value as { min?: number; max?: number };
    const len = ctx.text.length;
    let pass = true;
    const messages: string[] = [];

    if (opts.min != null && len < opts.min) {
      pass = false;
      messages.push(`length ${len} < min ${opts.min}`);
    }
    if (opts.max != null && len > opts.max) {
      pass = false;
      messages.push(`length ${len} > max ${opts.max}`);
    }

    return {
      operator: 'length',
      status: pass ? 'pass' : 'fail',
      expected: `${opts.min ?? '0'}..${opts.max ?? '∞'}`,
      actual: String(len),
      message: pass ? undefined : messages.join(', '),
    };
  },

  word_count: async (value, ctx) => {
    const opts = value as { min?: number; max?: number };
    const words = ctx.text.trim().split(/\s+/).filter(Boolean).length;
    let pass = true;
    const messages: string[] = [];

    if (opts.min != null && words < opts.min) {
      pass = false;
      messages.push(`word count ${words} < min ${opts.min}`);
    }
    if (opts.max != null && words > opts.max) {
      pass = false;
      messages.push(`word count ${words} > max ${opts.max}`);
    }

    return {
      operator: 'word_count',
      status: pass ? 'pass' : 'fail',
      expected: `${opts.min ?? '0'}..${opts.max ?? '∞'} words`,
      actual: `${words} words`,
      message: pass ? undefined : messages.join(', '),
    };
  },

  // Structural assertions
  json_valid: async (_value, ctx) => {
    try {
      JSON.parse(ctx.text);
      return { operator: 'json_valid', status: 'pass' };
    } catch {
      return {
        operator: 'json_valid',
        status: 'fail',
        message: 'Output is not valid JSON',
      };
    }
  },

  json_schema: async (_value, ctx) => {
    // Schema validation is a stretch goal — for now just validate JSON
    try {
      JSON.parse(ctx.text);
      return {
        operator: 'json_schema',
        status: 'pass',
        message: 'JSON is valid (schema validation not yet implemented)',
      };
    } catch {
      return {
        operator: 'json_schema',
        status: 'fail',
        message: 'Output is not valid JSON',
      };
    }
  },

  // AI/Semantic assertions (require LLM provider)
  llm_judge: async (value, ctx) => {
    const question = String(value);
    if (!ctx.llmProvider) {
      return {
        operator: 'llm_judge',
        status: 'error',
        message: 'LLM provider not configured — cannot run llm_judge assertion',
      };
    }

    const { pass, reasoning } = await ctx.llmProvider.judge(ctx.text, question);
    return {
      operator: 'llm_judge',
      status: pass ? 'pass' : 'fail',
      expected: question,
      actual: reasoning,
      message: pass
        ? `LLM judge: ${reasoning}`
        : `LLM judge answered "no": ${reasoning}`,
    };
  },

  similar_to: async (value, ctx) => {
    const opts = value as { dataset: string; threshold: number };
    if (!ctx.llmProvider) {
      return {
        operator: 'similar_to',
        status: 'error',
        message: 'LLM provider not configured — cannot run similar_to assertion',
      };
    }
    if (!ctx.loadGolden) {
      return {
        operator: 'similar_to',
        status: 'error',
        message: 'Dataset loader not configured — cannot run similar_to assertion',
      };
    }

    const golden = await ctx.loadGolden(opts.dataset);
    if (!golden) {
      return {
        operator: 'similar_to',
        status: 'error',
        message: `No golden response found in dataset "${opts.dataset}"`,
      };
    }

    const score = await ctx.llmProvider.similarity(ctx.text, golden);
    const pass = score >= opts.threshold;
    return {
      operator: 'similar_to',
      status: pass ? 'pass' : 'fail',
      expected: `similarity >= ${opts.threshold}`,
      actual: `similarity = ${score.toFixed(3)}`,
      message: pass ? undefined : `Similarity ${score.toFixed(3)} below threshold ${opts.threshold}`,
    };
  },

  sentiment: async (value, ctx) => {
    const expected = String(value);
    if (!ctx.llmProvider) {
      return {
        operator: 'sentiment',
        status: 'error',
        message: 'LLM provider not configured — cannot run sentiment assertion',
      };
    }

    const question = `Does this text have a ${expected} sentiment or tone?`;
    const { pass, reasoning } = await ctx.llmProvider.judge(ctx.text, question);
    return {
      operator: 'sentiment',
      status: pass ? 'pass' : 'fail',
      expected,
      actual: reasoning,
      message: pass ? undefined : `Sentiment does not match expected: ${expected}. ${reasoning}`,
    };
  },

  // Performance assertions (use LLM response metadata)
  latency: async (value, ctx) => {
    const opts = value as { max: number };
    const actual = ctx.llmResponse?.latencyMs;
    if (actual == null) {
      return {
        operator: 'latency',
        status: 'error',
        message: 'No latency data available',
      };
    }

    const pass = actual <= opts.max;
    return {
      operator: 'latency',
      status: pass ? 'pass' : 'fail',
      expected: `<= ${opts.max}ms`,
      actual: `${actual}ms`,
      message: pass ? undefined : `Latency ${actual}ms exceeds max ${opts.max}ms`,
    };
  },

  token_count: async (value, ctx) => {
    const opts = value as { max?: number; min?: number };
    const tokens = ctx.llmResponse?.tokens?.completion;
    if (tokens == null) {
      return {
        operator: 'token_count',
        status: 'error',
        message: 'No token count data available',
      };
    }

    let pass = true;
    const messages: string[] = [];
    if (opts.max != null && tokens > opts.max) {
      pass = false;
      messages.push(`tokens ${tokens} > max ${opts.max}`);
    }
    if (opts.min != null && tokens < opts.min) {
      pass = false;
      messages.push(`tokens ${tokens} < min ${opts.min}`);
    }

    return {
      operator: 'token_count',
      status: pass ? 'pass' : 'fail',
      expected: `${opts.min ?? '0'}..${opts.max ?? '∞'} tokens`,
      actual: `${tokens} tokens`,
      message: pass ? undefined : messages.join(', '),
    };
  },

  cost: async (value, ctx) => {
    const opts = value as { max: number };
    const actual = ctx.llmResponse?.costUsd;
    if (actual == null) {
      return {
        operator: 'cost',
        status: 'error',
        message: 'No cost data available',
      };
    }

    const pass = actual <= opts.max;
    return {
      operator: 'cost',
      status: pass ? 'pass' : 'fail',
      expected: `<= $${opts.max}`,
      actual: `$${actual.toFixed(4)}`,
      message: pass ? undefined : `Cost $${actual.toFixed(4)} exceeds max $${opts.max}`,
    };
  },
};

// =============================================================================
// HELPERS
// =============================================================================

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}
