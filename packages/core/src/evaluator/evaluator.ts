/**
 * @fileoverview Echo Evaluator - Condition evaluation engine
 *
 * This file implements the evaluator for Echo DSL.
 * The evaluator processes the AST and determines which nodes should be rendered
 * based on the provided context and condition evaluation.
 *
 * KEY OPTIMIZATION: AI JUDGE PARALLELIZATION
 * Before evaluating the AST, we:
 * 1. Collect ALL #ai_judge conditions from the tree
 * 2. Evaluate them in parallel using Promise.all
 * 3. Cache the results
 * 4. Use cached results during tree evaluation
 *
 * This prevents sequential blocking on AI calls.
 */

import type {
  ASTNode,
  ConditionalNode,
  ConditionExpr,
  EchoConfig,
  IncludeNode,
  OperatorDefinition,
  SectionNode,
} from '../types.js';
import { collectAiJudgeConditions } from '../parser/ast.js';
import { getOperator } from './operators.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Evaluation context containing variables and resolved AI judges.
 */
export interface EvaluationContext {
  /** Variables from user context */
  variables: Record<string, unknown>;
  /** Pre-resolved AI judge results (from parallel evaluation) */
  aiJudgeResults: Map<string, boolean>;
  /** Configuration */
  config: EchoConfig;
  /** Registered sections (for [#INCLUDE]) */
  sections: Map<string, ASTNode[]>;
  /** Custom operators (plugins) */
  operators: Map<string, OperatorDefinition>;
}

/**
 * Result of evaluating a node.
 */
export interface EvaluatedNode {
  /** The original node */
  node: ASTNode;
  /** Whether this node should be rendered */
  shouldRender: boolean;
  /** For conditionals: the branch to render */
  selectedBranch?: ASTNode[];
}

// =============================================================================
// VARIABLE RESOLUTION
// =============================================================================

/**
 * Options for variable resolution.
 */
export interface ResolveVariableOptions {
  /** Whether to throw on malformed paths (default: false) */
  strict?: boolean;
}

/**
 * Resolve a variable path from context.
 *
 * Supports:
 * - Simple: "name" -> context.name
 * - Nested: "user.name" -> context.user.name
 * - Array: "items[0]" -> context.items[0]
 * - Mixed: "users[0].name" -> context.users[0].name
 *
 * @param path - The variable path
 * @param context - The context object
 * @param options - Resolution options
 * @returns The resolved value or undefined
 *
 * @example
 * ```typescript
 * const context = { user: { name: 'Alice' }, items: [1, 2, 3] };
 * resolveVariable('user.name', context); // 'Alice'
 * resolveVariable('items[0]', context);  // 1
 * ```
 */
export function resolveVariable(
  path: string,
  context: Record<string, unknown>,
  options: ResolveVariableOptions = {}
): unknown {
  const { strict = false } = options;

  // Handle array access within parts: "items[0].name" -> ["items[0]", "name"]
  // Then further split "items[0]" into array access
  const parts = path.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }

    // Validate array access patterns before splitting
    // This catches malformed patterns like items[], items[abc], items[-1]
    if (strict) {
      validateArrayAccessPattern(part, path);
    }

    // Check for array access pattern: "items[0]" or "items[0][1]"
    const segments = part.split(/(\[\d+])/g).filter(Boolean);

    for (const segment of segments) {
      if (current === undefined || current === null) {
        return undefined;
      }

      const arrayMatch = segment.match(/^\[(\d+)]$/);
      if (arrayMatch && arrayMatch[1]) {
        // Array index access
        const index = parseInt(arrayMatch[1], 10);
        if (Array.isArray(current)) {
          current = current[index];
        } else {
          if (strict) {
            throw new Error(
              `Cannot access index [${index}] on non-array value in path "${path}"`
            );
          }
          return undefined;
        }
      } else {
        // Property access
        current = (current as Record<string, unknown>)[segment];
      }
    }
  }

  return current;
}

/**
 * Validate array access patterns in a path segment.
 * Throws descriptive errors for malformed patterns in strict mode.
 *
 * @param segment - A single path segment (e.g., "items[0]" or "name")
 * @param fullPath - The full path for error messages
 */
function validateArrayAccessPattern(segment: string, fullPath: string): void {
  // Find all bracket patterns in the segment
  const bracketPattern = /\[([^\]]*)]/g;
  let match;

  while ((match = bracketPattern.exec(segment)) !== null) {
    const bracketContent = match[1] ?? '';

    // Empty brackets: items[]
    if (bracketContent === '') {
      throw new Error(
        `Invalid array access "[]" in path "${fullPath}". Array index must be a non-negative integer.`
      );
    }

    // Non-numeric content: items[abc]
    if (!/^\d+$/.test(bracketContent)) {
      // Check for negative index
      if (/^-\d+$/.test(bracketContent)) {
        throw new Error(
          `Invalid array access "[${bracketContent}]" in path "${fullPath}". Negative indices are not supported.`
        );
      }

      throw new Error(
        `Invalid array access "[${bracketContent}]" in path "${fullPath}". Array index must be a non-negative integer.`
      );
    }
  }

  // Check for unclosed brackets: items[0
  const openBrackets = (segment.match(/\[/g) || []).length;
  const closeBrackets = (segment.match(/]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    throw new Error(
      `Malformed array access in path "${fullPath}". Unclosed or unmatched brackets.`
    );
  }
}

// =============================================================================
// CONDITION EVALUATION
// =============================================================================

/**
 * Evaluate a condition expression.
 *
 * @param condition - The condition to evaluate
 * @param ctx - The evaluation context
 * @returns true if condition is satisfied
 */
export async function evaluateCondition(
  condition: ConditionExpr,
  ctx: EvaluationContext
): Promise<boolean> {
  // Get the variable value
  const value = resolveVariable(condition.variable, ctx.variables, {
    strict: ctx.config.strict,
  });

  // Check for pre-resolved AI judge result
  if (condition.isAiJudge) {
    const cacheKey = createAiJudgeCacheKey(condition.variable, value, condition.argument);
    const cached = ctx.aiJudgeResults.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    // Fall through to operator evaluation if not cached
  }

  // Get the operator (strip # if present)
  const operatorName = condition.operator.replace(/^#/, '');
  const operator =
    ctx.operators.get(operatorName) ?? getOperator(operatorName);

  if (!operator) {
    // Unknown operator - treat as false in lenient mode, throw in strict
    if (ctx.config.strict) {
      throw new Error(`Unknown operator: #${operatorName}`);
    }
    return false;
  }

  // Evaluate the operator
  try {
    return await operator.handler(value, condition.argument);
  } catch (error) {
    if (ctx.config.strict) {
      throw error;
    }
    // Lenient mode: treat errors as false
    return false;
  }
}

/**
 * Create a cache key for AI judge results.
 */
function createAiJudgeCacheKey(
  variable: string,
  value: unknown,
  argument: unknown
): string {
  return JSON.stringify({ variable, value, argument });
}

// =============================================================================
// AI JUDGE PARALLEL EVALUATION
// =============================================================================

/**
 * Pre-evaluate all AI judge conditions in parallel.
 *
 * This is the key optimization for performance.
 * Call this before evaluating the AST to pre-resolve all AI conditions.
 *
 * @param ast - The AST to scan for AI judges
 * @param ctx - The evaluation context (will be mutated with results)
 */
export async function preEvaluateAiJudges(
  ast: ASTNode[],
  ctx: EvaluationContext
): Promise<void> {
  // Collect all AI judge conditions
  const aiJudges = collectAiJudgeConditions(ast);

  if (aiJudges.length === 0) {
    return;
  }

  // Prepare evaluation promises
  const evaluations = aiJudges.map(async ({ condition }) => {
    const value = resolveVariable(condition.variable, ctx.variables, {
      strict: ctx.config.strict,
    });
    const cacheKey = createAiJudgeCacheKey(
      condition.variable,
      value,
      condition.argument
    );

    // Skip if already cached
    if (ctx.aiJudgeResults.has(cacheKey)) {
      return;
    }

    // Evaluate using the AI judge operator
    const operator = ctx.operators.get('ai_judge') ?? getOperator('ai_judge');
    if (!operator) {
      throw new Error('AI Judge operator not available');
    }

    try {
      const result = await operator.handler(value, condition.argument);
      ctx.aiJudgeResults.set(cacheKey, result);
    } catch (error) {
      // Handle AI evaluation error
      if (ctx.config.strict) {
        throw error;
      }
      // Lenient: default to false
      ctx.aiJudgeResults.set(cacheKey, false);
    }
  });

  // Evaluate all in parallel
  await Promise.all(evaluations);
}

// =============================================================================
// AST EVALUATION
// =============================================================================

/**
 * Evaluate a conditional node and determine which branch to render.
 *
 * @param node - The conditional node
 * @param ctx - The evaluation context
 * @returns The nodes to render (empty if condition is false with no else)
 */
export async function evaluateConditional(
  node: ConditionalNode,
  ctx: EvaluationContext
): Promise<ASTNode[]> {
  // Evaluate the main condition
  const conditionResult = await evaluateCondition(node.condition, ctx);

  if (conditionResult) {
    return node.consequent;
  }

  // Check alternate (ELSE IF or ELSE)
  if (node.alternate) {
    if (Array.isArray(node.alternate)) {
      // ELSE branch
      return node.alternate;
    } else {
      // ELSE IF branch (recursive)
      return evaluateConditional(node.alternate, ctx);
    }
  }

  // No matching branch
  return [];
}

/**
 * Evaluate a single AST node.
 *
 * @param node - The node to evaluate
 * @param ctx - The evaluation context
 * @returns Array of nodes to render (may be empty, one, or many)
 */
async function evaluateNode(
  node: ASTNode,
  ctx: EvaluationContext
): Promise<ASTNode[]> {
  switch (node.type) {
    case 'text':
      // Text nodes pass through unchanged
      return [node];

    case 'variable':
      // Variable nodes pass through unchanged (resolved during rendering)
      return [node];

    case 'conditional': {
      // Evaluate condition and get selected branch
      const branchNodes = await evaluateConditional(node, ctx);
      // Recursively evaluate the selected branch
      return evaluateNodes(branchNodes, ctx);
    }

    case 'section': {
      // Store section in context for later [#INCLUDE] references
      ctx.sections.set(node.name, node.body);
      // Sections are not rendered inline
      return [];
    }

    case 'import':
      // Import handling: In a full implementation, we would:
      // 1. Read the imported file
      // 2. Parse it
      // 3. Evaluate and inline the result
      // For now, we pass through and let the renderer warn
      return [node];

    case 'include': {
      // Include handling: inline the section content
      const includeNode = node as IncludeNode;
      const sectionContent = ctx.sections.get(includeNode.name);
      if (sectionContent) {
        // Recursively evaluate the section content
        return evaluateNodes(sectionContent, ctx);
      }
      // Section not found - pass through and let renderer warn
      if (ctx.config.strict) {
        throw new Error(`Section not found: ${includeNode.name}`);
      }
      return [];
    }

    case 'context':
      // Context nodes are passed through to the renderer
      // Context resolution happens separately (either during evaluation or in the renderer)
      // This allows context to be resolved in batch for efficiency
      return [node];

    default: {
      // Exhaustiveness check
      throw new Error(`Unknown node type: ${(node as ASTNode).type}`);
    }
  }
}

/**
 * Evaluate an array of AST nodes.
 *
 * @param nodes - The nodes to evaluate
 * @param ctx - The evaluation context
 * @returns Flattened array of nodes to render
 */
async function evaluateNodes(
  nodes: ASTNode[],
  ctx: EvaluationContext
): Promise<ASTNode[]> {
  const results: ASTNode[] = [];

  for (const node of nodes) {
    const evaluated = await evaluateNode(node, ctx);
    results.push(...evaluated);
  }

  return results;
}

// =============================================================================
// SECTION COLLECTION (First Pass)
// =============================================================================

/**
 * Collect all section definitions from the AST.
 * This is a first pass to ensure sections are available before includes.
 *
 * @param nodes - The AST nodes to scan
 * @param sections - Map to store section definitions
 */
function collectSections(
  nodes: ASTNode[],
  sections: Map<string, ASTNode[]>
): void {
  for (const node of nodes) {
    if (node.type === 'section') {
      const sectionNode = node as SectionNode;
      sections.set(sectionNode.name, sectionNode.body);
      // Also scan inside the section for nested sections
      collectSections(sectionNode.body, sections);
    } else if (node.type === 'conditional') {
      const conditionalNode = node as ConditionalNode;
      collectSections(conditionalNode.consequent, sections);
      if (conditionalNode.alternate) {
        if (Array.isArray(conditionalNode.alternate)) {
          collectSections(conditionalNode.alternate, sections);
        } else {
          collectSections([conditionalNode.alternate], sections);
        }
      }
    }
  }
}

// =============================================================================
// MAIN EVALUATE FUNCTION
// =============================================================================

/**
 * Evaluate an AST with the given context.
 *
 * This is the main entry point for AST evaluation. It:
 * 1. Collects section definitions (first pass)
 * 2. Pre-evaluates AI judge conditions in parallel
 * 3. Evaluates the AST and selects conditional branches
 * 4. Returns a flattened AST ready for rendering
 *
 * @param ast - The AST to evaluate
 * @param context - Variable context
 * @param config - Echo configuration
 * @param operators - Custom operators (from plugins)
 * @returns Evaluated AST and section map
 *
 * @example
 * ```typescript
 * const result = await evaluate(ast, { name: 'Alice', age: 25 });
 * console.log(result.ast); // Flattened, evaluated AST
 * ```
 */
export async function evaluate(
  ast: ASTNode[],
  context: Record<string, unknown>,
  config: EchoConfig = {},
  operators: Map<string, OperatorDefinition> = new Map()
): Promise<{ ast: ASTNode[]; sections: Map<string, ASTNode[]> }> {
  // Create evaluation context
  const ctx: EvaluationContext = {
    variables: context,
    aiJudgeResults: new Map(),
    config,
    sections: new Map(),
    operators,
  };

  // First pass: collect all section definitions
  collectSections(ast, ctx.sections);

  // Pre-evaluate AI judges in parallel (optimization!)
  await preEvaluateAiJudges(ast, ctx);

  // Second pass: evaluate the AST
  const evaluatedAst = await evaluateNodes(ast, ctx);

  return { ast: evaluatedAst, sections: ctx.sections };
}

/**
 * Create an evaluation context manually.
 * Useful for advanced use cases where you need more control.
 *
 * @param options - Context options
 * @returns A new EvaluationContext
 */
export function createEvaluationContext(options: {
  variables: Record<string, unknown>;
  config?: EchoConfig;
  operators?: Map<string, OperatorDefinition>;
}): EvaluationContext {
  return {
    variables: options.variables,
    aiJudgeResults: new Map(),
    config: options.config ?? {},
    sections: new Map(),
    operators: options.operators ?? new Map(),
  };
}
