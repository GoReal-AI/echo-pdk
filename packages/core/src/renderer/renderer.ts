/**
 * @fileoverview Echo Renderer - AST to text output
 *
 * This file implements the renderer for Echo DSL.
 * The renderer traverses the evaluated AST and produces the final text output.
 *
 * By the time the renderer runs:
 * 1. All conditions have been evaluated
 * 2. Only the nodes that should be rendered are in the AST
 * 3. AI judges have been resolved
 *
 * The renderer's job is to:
 * 1. Walk the AST
 * 2. For text nodes: output the text as-is
 * 3. For variable nodes: substitute the value from context
 * 4. Preserve whitespace (prompts are whitespace-sensitive)
 */

import type {
  ASTNode,
  VariableNode,
  TextNode,
  EchoConfig,
  OperatorDefinition,
} from '../types.js';
import { parse } from '../parser/parser.js';
import { evaluate, resolveVariable } from '../evaluator/evaluator.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for the renderer.
 */
export interface RenderOptions {
  /** Variable context */
  context: Record<string, unknown>;
  /** Echo configuration */
  config?: EchoConfig;
  /** Trim leading/trailing whitespace from output */
  trim?: boolean;
  /** Collapse multiple newlines into one */
  collapseNewlines?: boolean;
}

// =============================================================================
// RENDERER
// =============================================================================

/**
 * Render an evaluated AST to a string.
 *
 * @param ast - The evaluated AST nodes
 * @param options - Render options
 * @returns The rendered string
 *
 * @example
 * ```typescript
 * const output = render(evaluatedAst, {
 *   context: { name: 'Alice' },
 *   trim: true,
 * });
 * ```
 */
export function render(ast: ASTNode[], options: RenderOptions): string {
  const parts: string[] = [];

  for (const node of ast) {
    const rendered = renderNode(node, options);
    if (rendered !== undefined) {
      parts.push(rendered);
    }
  }

  let result = parts.join('');

  // Apply post-processing
  if (options.collapseNewlines) {
    result = collapseNewlines(result);
  }

  if (options.trim) {
    result = result.trim();
  }

  return result;
}

/**
 * Render a single AST node.
 *
 * @param node - The node to render
 * @param options - Render options
 * @returns The rendered string or undefined if nothing to render
 */
function renderNode(node: ASTNode, options: RenderOptions): string | undefined {
  switch (node.type) {
    case 'text':
      return renderText(node);

    case 'variable':
      return renderVariable(node, options);

    case 'conditional':
      // By the time we render, conditionals should have been evaluated
      // This shouldn't happen, but handle gracefully
      return render(node.consequent, options);

    case 'section':
      // Section definitions are not rendered inline
      // They're stored for [#INCLUDE] references
      return undefined;

    case 'import':
      // Imports should be resolved before rendering
      // If we see one here, it means it wasn't resolved
      if (options.config?.strict) {
        throw new Error(`Unresolved import: ${node.path}`);
      }
      return undefined;

    case 'include':
      // Includes should be resolved before rendering
      if (options.config?.strict) {
        throw new Error(`Unresolved include: ${node.name}`);
      }
      return undefined;

    default: {
      // Exhaustiveness check
      const _exhaustive: never = node;
      throw new Error(`Unknown node type: ${(_exhaustive as ASTNode).type}`);
    }
  }
}

/**
 * Render a text node.
 */
function renderText(node: TextNode): string {
  return node.value;
}

/**
 * Render a variable node.
 *
 * @param node - The variable node
 * @param options - Render options
 * @returns The variable value as string
 */
function renderVariable(node: VariableNode, options: RenderOptions): string {
  const value = resolveVariable(node.path, options.context);

  // Handle undefined
  if (value === undefined || value === null) {
    // Use default value if provided
    if (node.defaultValue !== undefined) {
      return node.defaultValue;
    }

    // In strict mode, throw
    if (options.config?.strict) {
      throw new Error(`Undefined variable: ${node.path}`);
    }

    // Lenient mode: render empty string
    return '';
  }

  // Convert to string
  return stringify(value);
}

/**
 * Convert a value to string for rendering.
 *
 * @param value - The value to stringify
 * @returns String representation
 */
function stringify(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(stringify).join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

// =============================================================================
// POST-PROCESSING
// =============================================================================

/**
 * Collapse multiple consecutive newlines into a maximum of two.
 *
 * This is useful for cleaning up output when conditionals
 * leave empty lines.
 */
function collapseNewlines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n');
}

// =============================================================================
// FULL RENDER PIPELINE
// =============================================================================

/**
 * Full render pipeline: parse -> evaluate -> render.
 *
 * This is the main entry point for rendering a template.
 *
 * @param template - The Echo template string
 * @param context - Variable context
 * @param config - Echo configuration
 * @param operators - Custom operators from plugins
 * @returns The rendered string
 *
 * @example
 * ```typescript
 * const output = await renderTemplate(
 *   'Hello {{name}}!',
 *   { name: 'Alice' }
 * );
 * // Output: "Hello Alice!"
 * ```
 *
 * @example
 * ```typescript
 * const template = `
 * [#IF {{tier}} #equals(premium)]
 *   Welcome, premium user!
 * [ELSE]
 *   Upgrade to premium for more features.
 * [END IF]
 * `;
 *
 * const output = await renderTemplate(template, { tier: 'premium' });
 * // Output: "  Welcome, premium user!\n"
 * ```
 */
export async function renderTemplate(
  template: string,
  context: Record<string, unknown>,
  config: EchoConfig = {},
  operators: Map<string, OperatorDefinition> = new Map()
): Promise<string> {
  // Step 1: Parse the template to AST
  const parseResult = parse(template);

  if (!parseResult.success || !parseResult.ast) {
    const errorMessages = parseResult.errors
      .map((e) => {
        if (e.location) {
          return `${e.message} at line ${e.location.startLine}, column ${e.location.startColumn}`;
        }
        return e.message;
      })
      .join('\n');
    throw new Error(`Parse error:\n${errorMessages}`);
  }

  // Step 2: Evaluate the AST
  const { ast: evaluatedAst } = await evaluate(
    parseResult.ast,
    context,
    config,
    operators
  );

  // Step 3: Render the evaluated AST
  return render(evaluatedAst, {
    context,
    config,
    trim: false, // Preserve whitespace by default
    collapseNewlines: true, // Clean up empty lines from conditionals
  });
}

/**
 * Format errors with source context for display.
 *
 * @param template - The original template
 * @param errors - Parse or evaluation errors
 * @returns Formatted error string
 */
export function formatErrors(
  template: string,
  errors: { message: string; location?: { startLine: number; startColumn: number } }[]
): string {
  const lines = template.split('\n');
  const formatted: string[] = [];

  for (const error of errors) {
    formatted.push(`Error: ${error.message}`);

    if (error.location) {
      const { startLine, startColumn } = error.location;
      const lineIndex = startLine - 1;

      if (lineIndex >= 0 && lineIndex < lines.length) {
        const sourceLine = lines[lineIndex];
        const pointer = ' '.repeat(startColumn - 1) + '^';

        formatted.push(`  ${startLine} | ${sourceLine}`);
        formatted.push(`    | ${pointer}`);
      }
    }

    formatted.push('');
  }

  return formatted.join('\n');
}
