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
  ContentBlock,
  ContextNode,
  EchoConfig,
  MultimodalContent,
  OperatorDefinition,
  TextNode,
  VariableNode,
} from '../types.js';
import { parse } from '../parser/parser.js';
import { evaluate, resolveVariable } from '../evaluator/evaluator.js';
import {
  isSupportedFileType,
  normalizeBooleanValue,
  normalizeFileValue,
  normalizeNumberValue,
} from '../utils/file-utils.js';

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

    case 'context':
      return renderContext(node, options);

    default: {
      // Exhaustiveness check
      const exhaustiveCheck: never = node;
      throw new Error(`Unknown node type: ${(exhaustiveCheck as ASTNode).type}`);
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
 * Render a context node.
 *
 * Context nodes reference files from the Context Store.
 * They should be resolved before rendering (during evaluation phase).
 *
 * @param node - The context node
 * @param options - Render options
 * @returns The resolved content or a placeholder
 */
function renderContext(node: ContextNode, options: RenderOptions): string {
  // If content has been resolved, render it
  if (node.resolvedContent) {
    // For images, return the data URL (consumer will handle formatting)
    if (node.resolvedContent.dataUrl) {
      return node.resolvedContent.dataUrl;
    }
    // For text content, return the text
    if (node.resolvedContent.text) {
      return node.resolvedContent.text;
    }
  }

  // Content not resolved - context should be resolved before rendering
  if (options.config?.strict) {
    throw new Error(`Unresolved context: ${node.path}`);
  }

  // Lenient mode: return placeholder
  return `[CONTEXT: ${node.path}]`;
}

// =============================================================================
// MULTIMODAL RENDERING
// =============================================================================

/**
 * Render an evaluated AST to multimodal content blocks.
 *
 * This produces an array of ContentBlock objects compatible with
 * OpenAI's multimodal message format. Text is grouped together,
 * and images are separate image_url blocks.
 *
 * @param ast - The evaluated AST nodes
 * @param options - Render options
 * @returns Array of content blocks
 *
 * @example
 * ```typescript
 * const blocks = renderMultimodal(evaluatedAst, { context: {} });
 * // Result:
 * // [
 * //   { type: 'text', text: 'Analyze this image:' },
 * //   { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } },
 * //   { type: 'text', text: 'What do you see?' }
 * // ]
 * ```
 */
export function renderMultimodal(ast: ASTNode[], options: RenderOptions): MultimodalContent {
  const blocks: ContentBlock[] = [];
  let currentText = '';

  /**
   * Flush accumulated text to a text block.
   */
  function flushText(): void {
    if (currentText.length > 0) {
      let text = currentText;

      // Apply post-processing
      if (options.collapseNewlines) {
        text = collapseNewlines(text);
      }

      blocks.push({ type: 'text', text });
      currentText = '';
    }
  }

  /**
   * Process a single node.
   */
  function processNode(node: ASTNode): void {
    switch (node.type) {
      case 'text':
        currentText += node.value;
        break;

      case 'variable':
        // Handle file-typed variables specially for multimodal
        if (node.varType === 'file') {
          const value = resolveVariable(node.path, options.context, {
            strict: options.config?.strict,
          });
          const fileValue = normalizeFileValue(value);

          if (fileValue && isImageMimeType(fileValue.mimeType)) {
            // Image file: flush text and add image block
            flushText();
            blocks.push({
              type: 'image_url',
              image_url: {
                url: fileValue.dataUrl,
              },
            });
          } else {
            // Non-image file or invalid: render as text
            currentText += renderVariable(node, options);
          }
        } else {
          currentText += renderVariable(node, options);
        }
        break;

      case 'conditional':
        // By the time we render, conditionals should have been evaluated
        for (const child of node.consequent) {
          processNode(child);
        }
        break;

      case 'section':
        // Section definitions are not rendered inline
        break;

      case 'import':
      case 'include':
        // Should be resolved before rendering
        if (options.config?.strict) {
          throw new Error(`Unresolved ${node.type}: ${node.type === 'import' ? node.path : node.name}`);
        }
        break;

      case 'context':
        // Context nodes become either text (inline) or image blocks
        if (node.resolvedContent) {
          if (node.resolvedContent.dataUrl && isImageMimeType(node.resolvedContent.mimeType)) {
            // Image content: flush text and add image block
            flushText();
            blocks.push({
              type: 'image_url',
              image_url: {
                url: node.resolvedContent.dataUrl,
              },
            });
          } else if (node.resolvedContent.text) {
            // Text content: append to current text
            currentText += node.resolvedContent.text;
          } else if (node.resolvedContent.dataUrl) {
            // Non-image data URL (rare): append as text
            currentText += node.resolvedContent.dataUrl;
          }
        } else {
          // Unresolved context
          if (options.config?.strict) {
            throw new Error(`Unresolved context: ${node.path}`);
          }
          currentText += `[CONTEXT: ${node.path}]`;
        }
        break;

      default: {
        // Exhaustiveness check
        throw new Error(`Unknown node type: ${(node as ASTNode).type}`);
      }
    }
  }

  // Process all nodes
  for (const node of ast) {
    processNode(node);
  }

  // Flush any remaining text
  flushText();

  // Apply trim to first and last text blocks if requested
  if (options.trim && blocks.length > 0) {
    const first = blocks[0];
    if (first && first.type === 'text') {
      first.text = first.text.trimStart();
      if (first.text.length === 0) {
        blocks.shift();
      }
    }

    if (blocks.length > 0) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'text') {
        last.text = last.text.trimEnd();
        if (last.text.length === 0) {
          blocks.pop();
        }
      }
    }
  }

  return blocks;
}

/**
 * Check if a MIME type is an image type.
 */
function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Render a variable node.
 *
 * Supports typed variables:
 * - text (default): String value from context
 * - boolean: Normalizes to "true" or "false"
 * - number: Parses and validates as number
 * - file: For file references (returns data URL or placeholder)
 *
 * @param node - The variable node
 * @param options - Render options
 * @returns The variable value as string
 */
function renderVariable(node: VariableNode, options: RenderOptions): string {
  const value = resolveVariable(node.path, options.context, {
    strict: options.config?.strict,
  });

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

    // Lenient mode: render type-appropriate placeholder
    switch (node.varType) {
      case 'file':
        return `[File not provided: ${node.path}]`;
      case 'boolean':
        return 'false';
      case 'number':
        return '0';
      default:
        return '';
    }
  }

  // Handle based on variable type
  switch (node.varType) {
    case 'boolean':
      return normalizeBooleanValue(value);

    case 'number':
      return normalizeNumberValue(value);

    case 'file': {
      const fileValue = normalizeFileValue(value);
      if (!fileValue) {
        if (options.config?.strict) {
          throw new Error(`Invalid file value for variable: ${node.path}`);
        }
        return `[Invalid file: ${node.path}]`;
      }
      if (!isSupportedFileType(fileValue.mimeType)) {
        if (options.config?.strict) {
          throw new Error(`Unsupported file type: ${fileValue.mimeType}`);
        }
        return `[Unsupported file type: ${fileValue.mimeType}]`;
      }
      // Return the data URL for text rendering
      return fileValue.dataUrl;
    }

    case 'text':
    default:
      return stringify(value);
  }
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
    const formattedErrors = formatErrors(template, parseResult.errors);
    throw new Error(`Parse error:\n${formattedErrors}`);
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
