/**
 * @fileoverview High-level runPrompt API
 *
 * Renders an echo-pdk template with variables, sends the result to an LLM
 * provider, and returns both the rendered prompt and the LLM response.
 *
 * Import note: We import parse/evaluate/render directly from their modules
 * (not from ../index.ts) to avoid circular dependencies, since index.ts
 * imports from ai-judge which imports from providers.
 */

import { parse } from '../parser/parser.js';
import { evaluate } from '../evaluator/index.js';
import { render, renderMessages, formatErrors } from '../renderer/renderer.js';
import { createProvider } from './registry.js';
import type { ProviderConfig, CompletionResponse } from './types.js';
import type { RenderResult } from '../types.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for runPrompt.
 */
export interface RunPromptOptions {
  /** Echo DSL template string */
  template: string;
  /** Variables to substitute in the template */
  variables: Record<string, unknown>;
  /** Provider configuration (type, apiKey, model, etc.) */
  provider: ProviderConfig;
  /** Optional system message prepended to the LLM call */
  systemMessage?: string;
  /** Temperature for LLM call */
  temperature?: number;
  /** Max tokens for LLM response */
  maxTokens?: number;
}

/**
 * Result from runPrompt.
 */
export interface RunPromptResult {
  /** The rendered prompt (after template + variable resolution) */
  renderedPrompt: string;
  /** The structured render result (messages + tools) */
  renderResult: RenderResult;
  /** The LLM completion response */
  response: CompletionResponse;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Render a template and send it to an LLM in one call.
 *
 * Steps:
 * 1. Parse the Echo DSL template
 * 2. Evaluate conditions with the provided variables
 * 3. Render to a string
 * 4. Send to the specified LLM provider
 * 5. Return both the rendered prompt and the response
 *
 * **Limitation:** Templates using `#ai_gate` conditionals are not supported
 * by this function. Use `createEcho()` with an `aiProvider` config for
 * templates that require AI-evaluated conditions.
 *
 * @param options - Template, variables, and provider configuration
 * @returns The rendered prompt and LLM response
 *
 * @example
 * ```typescript
 * const result = await runPrompt({
 *   template: 'Recommend a {{genre}} movie for {{companions}}.',
 *   variables: { genre: 'Comedy', companions: 'Family' },
 *   provider: { type: 'openai', apiKey: 'sk-...', model: 'gpt-4o' },
 * });
 * console.log(result.renderedPrompt);
 * // → "Recommend a Comedy movie for Family."
 * console.log(result.response.text);
 * // → "I'd recommend..."
 * ```
 */
export async function runPrompt(options: RunPromptOptions): Promise<RunPromptResult> {
  const { template, variables, provider: providerConfig, systemMessage } = options;

  // 1. Parse
  const parseResult = parse(template);
  if (!parseResult.success || !parseResult.ast) {
    const formattedErrors = formatErrors(template, parseResult.errors);
    throw new Error(`Parse error:\n${formattedErrors}`);
  }

  // 2. Evaluate (resolve conditionals with the given variables)
  const { ast: evaluatedAst } = await evaluate(parseResult.ast, variables, {});

  // 3. Render to structured messages + tools
  const renderOpts = {
    context: variables,
    config: {},
    trim: false,
    collapseNewlines: true,
  };
  const renderResult = renderMessages(evaluatedAst, renderOpts);

  // Also get flat string for backward compat
  const renderedPrompt = render(evaluatedAst, renderOpts);

  // 4. Create provider and send to LLM
  const instance = createProvider(providerConfig);

  // Build messages: use structured roles if available, otherwise legacy
  const messages = renderResult.messages.map(m => {
    const first = m.content[0];
    const content = m.content.length === 1 && first && first.type === 'text'
      ? first.text  // Simple string for single text block
      : m.content;
    return { role: m.role, content };
  });

  // Prepend systemMessage option if provided and no system role in template
  if (systemMessage && !renderResult.messages.some(m => m.role === 'system')) {
    messages.unshift({ role: 'system' as const, content: systemMessage });
  }

  const response = await instance.complete(messages, {
    model: providerConfig.model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    tools: renderResult.tools.length > 0 ? renderResult.tools : undefined,
  });

  return { renderedPrompt, renderResult, response };
}
