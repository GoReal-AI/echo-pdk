/**
 * @fileoverview Echo Renderer - AST to text output
 *
 * This file implements the renderer for Echo DSL.
 * The renderer traverses the evaluated AST and produces the final text output.
 *
 * IMPLEMENTATION GUIDE:
 *
 * The renderer is relatively simple - by the time it runs:
 * 1. All conditions have been evaluated
 * 2. Only the nodes that should be rendered are in the AST
 * 3. AI judges have been resolved
 *
 * The renderer's job is to:
 * 1. Walk the AST
 * 2. For text nodes: output the text as-is
 * 3. For variable nodes: substitute the value from context
 * 4. For other nodes: recursively render their content
 *
 * IMPORTANT: Preserve whitespace! Prompts are whitespace-sensitive.
 */

import type { ASTNode, VariableNode, TextNode, EchoConfig } from '../types.js';
import { resolveVariable } from '../evaluator/evaluator.js';
import { visitNode, type ASTVisitor } from '../parser/ast.js';

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
 * Render an AST to a string.
 *
 * @param ast - The evaluated AST nodes
 * @param options - Render options
 * @returns The rendered string
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
      // By the time we render, conditionals should be flattened
      // But just in case, render the consequent
      return render(node.consequent, options);

    case 'section':
      // Section definitions are not rendered inline
      // They're stored for [#INCLUDE] references
      return undefined;

    case 'import':
      // Imports should be resolved before rendering
      // If we see one here, it means it wasn't resolved
      console.warn(`Unresolved import: ${node.path}`);
      return undefined;

    case 'include':
      // Includes should be resolved before rendering
      console.warn(`Unresolved include: ${node.name}`);
      return undefined;

    default: {
      // Exhaustiveness check
      const _exhaustive: never = node;
      console.warn(`Unknown node type: ${(_exhaustive as ASTNode).type}`);
      return undefined;
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

    // In strict mode, this should have been caught earlier
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
 * Collapse multiple consecutive newlines into a single newline.
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
 * Full render pipeline: parse, evaluate, render.
 *
 * This is the main entry point for rendering a template.
 *
 * @param template - The Echo template string
 * @param context - Variable context
 * @param config - Echo configuration
 * @returns The rendered string
 */
export async function renderTemplate(
  template: string,
  context: Record<string, unknown>,
  config: EchoConfig = {}
): Promise<string> {
  // TODO: Implement full pipeline
  //
  // IMPLEMENTATION STEPS:
  // 1. Parse the template to AST
  //    const parseResult = parse(template);
  //    if (!parseResult.success) {
  //      throw new Error(formatErrors(parseResult.errors));
  //    }
  //
  // 2. Evaluate the AST
  //    const { ast: evaluatedAst } = await evaluate(
  //      parseResult.ast,
  //      context,
  //      config
  //    );
  //
  // 3. Render the evaluated AST
  //    return render(evaluatedAst, { context, config });

  throw new Error('Not implemented: renderTemplate()');
}

// =============================================================================
// IMPLEMENTATION NOTES
// =============================================================================

/*
NEXT STEPS TO IMPLEMENT:

1. COMPLETE renderTemplate
   Wire together parse → evaluate → render

2. ERROR FORMATTING
   Format errors nicely with line numbers and context:
   "Error at line 5, column 10: Unknown operator #foo
    5 | [#IF {{x}} #foo(y)]
              ^^^^^"

3. STREAMING OUTPUT
   For very large templates, consider streaming:
   - AsyncGenerator version that yields chunks
   - Useful for CLI and server responses

4. DEBUG MODE
   Add option to include debug comments in output:
   "<!-- IF: companions contains Shimon = true -->"

5. TESTS
   Create renderer.test.ts with tests for:
   - Simple text rendering
   - Variable substitution
   - Default values
   - Undefined variable handling
   - Whitespace preservation
   - Post-processing options
*/
