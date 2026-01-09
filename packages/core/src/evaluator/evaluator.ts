/**
 * @fileoverview Echo Evaluator - Condition evaluation engine
 *
 * This file implements the evaluator for Echo DSL.
 * The evaluator processes the AST and determines which nodes should be rendered
 * based on the provided context and condition evaluation.
 *
 * IMPLEMENTATION GUIDE:
 *
 * The evaluator's main responsibilities:
 * 1. Resolve variable references from context
 * 2. Evaluate conditions using operators
 * 3. Handle AI judge conditions with parallel optimization
 * 4. Determine which branches of conditionals to include
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
  OperatorDefinition,
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
 * Resolve a variable path from context.
 *
 * Supports:
 * - Simple: "name" -> context.name
 * - Nested: "user.name" -> context.user.name
 * - Array: "items[0]" -> context.items[0]
 *
 * @param path - The variable path
 * @param context - The context object
 * @returns The resolved value or undefined
 */
export function resolveVariable(
  path: string,
  context: Record<string, unknown>
): unknown {
  // TODO: Implement full variable resolution
  //
  // IMPLEMENTATION STEPS:
  // 1. Split path by '.' and '[' to get parts
  // 2. Walk the context object following the path
  // 3. Handle array access: "items[0]" -> items[0]
  // 4. Handle nested objects: "user.name" -> user.name
  // 5. Return undefined if any part is missing

  const parts = path.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }

    // Handle array access: "items[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, name, indexStr] = arrayMatch;
      const index = parseInt(indexStr ?? '0', 10);
      if (name) {
        current = (current as Record<string, unknown>)[name];
      }
      if (Array.isArray(current)) {
        current = current[index];
      } else {
        return undefined;
      }
    } else {
      // Simple property access
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
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
  const value = resolveVariable(condition.variable, ctx.variables);

  // Check for pre-resolved AI judge result
  if (condition.isAiJudge) {
    const cacheKey = createAiJudgeCacheKey(condition.variable, value, condition.argument);
    const cached = ctx.aiJudgeResults.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    // Fall through to operator evaluation if not cached
  }

  // Get the operator
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
    const result = await operator.handler(value, condition.argument);
    return result;
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
  // Simple stringification for cache key
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
    const value = resolveVariable(condition.variable, ctx.variables);
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

// =============================================================================
// MAIN EVALUATE FUNCTION
// =============================================================================

/**
 * Evaluate an AST with the given context.
 *
 * @param ast - The AST to evaluate
 * @param context - Variable context
 * @param config - Echo configuration
 * @param operators - Custom operators (from plugins)
 * @returns Evaluated nodes ready for rendering
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

  // Pre-evaluate AI judges in parallel (optimization!)
  await preEvaluateAiJudges(ast, ctx);

  // TODO: Implement full AST evaluation
  //
  // IMPLEMENTATION STEPS:
  // 1. First pass: collect section definitions
  // 2. Second pass: evaluate nodes
  //    - Text nodes: pass through
  //    - Variable nodes: resolve and substitute
  //    - Conditional nodes: evaluate and select branch
  //    - Import nodes: load and inline
  //    - Include nodes: inline section content
  //
  // The result should be a flattened list of nodes that should be rendered.

  return { ast, sections: ctx.sections };
}

// =============================================================================
// IMPLEMENTATION NOTES
// =============================================================================

/*
NEXT STEPS TO IMPLEMENT:

1. FULL AST EVALUATION
   Walk the AST and produce a "flattened" version:
   - Expand evaluated conditionals (only the selected branch)
   - Resolve includes
   - Keep text and variable nodes
   - Remove section definitions (they're stored in ctx.sections)

2. IMPORT HANDLING
   Import nodes need to:
   - Read the imported file
   - Parse it
   - Inline the resulting AST

3. INCLUDE HANDLING
   Include nodes need to:
   - Look up the section by name
   - Inline the section's AST

4. CIRCULAR IMPORT DETECTION
   Track imported files to detect circular imports.

5. TESTS
   Create evaluator.test.ts with tests for:
   - Variable resolution (simple, nested, array)
   - Each operator condition
   - Conditional evaluation (if, else if, else)
   - AI judge caching
   - Error handling (strict vs lenient)
*/
