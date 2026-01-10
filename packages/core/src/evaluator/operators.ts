/**
 * @fileoverview Built-in Operators for Echo DSL
 *
 * This file implements all built-in operators for the Echo DSL.
 * Operators are used in conditions: [#IF {{var}} #operator(arg)]
 *
 * IMPLEMENTATION GUIDE:
 *
 * Each operator is a function that:
 * - Takes a value (the variable being tested)
 * - Takes an optional argument (the operator parameter)
 * - Returns a boolean (or Promise<boolean> for async operators)
 *
 * BUILT-IN OPERATORS:
 * - #equals(value)     - Exact equality
 * - #contains(value)   - String/array contains
 * - #exists            - Value is defined and not empty
 * - #matches(regex)    - Regex pattern match
 * - #gt(n), #lt(n)     - Greater than, less than
 * - #gte(n), #lte(n)   - Greater/less than or equal
 * - #in(a,b,c)         - Value is in list
 * - #ai_judge(question) - LLM-evaluated condition
 */

import type { OperatorDefinition } from '../types.js';

// =============================================================================
// COMPARISON OPERATORS
// =============================================================================

/**
 * #equals - Exact equality check
 *
 * @example {{genre}} #equals(Horror)
 */
export const equalsOperator: OperatorDefinition = {
  type: 'comparison',
  description: 'Exact equality check',
  example: '{{genre}} #equals(Horror)',
  autocomplete: {
    trigger: '#eq',
    snippet: '#equals($1)',
  },
  handler: (value: unknown, argument: unknown): boolean => {
    // Handle string comparison (case-insensitive by default)
    if (typeof value === 'string' && typeof argument === 'string') {
      return value.toLowerCase() === argument.toLowerCase();
    }
    // Strict equality for other types
    return value === argument;
  },
};

/**
 * #contains - Check if string/array contains a value
 *
 * @example {{companions}} #contains(Shimon)
 */
export const containsOperator: OperatorDefinition = {
  type: 'comparison',
  description: 'Check if string or array contains value',
  example: '{{companions}} #contains(Shimon)',
  autocomplete: {
    trigger: '#con',
    snippet: '#contains($1)',
  },
  handler: (value: unknown, argument: unknown): boolean => {
    if (typeof value === 'string' && typeof argument === 'string') {
      return value.toLowerCase().includes(argument.toLowerCase());
    }
    if (Array.isArray(value)) {
      return value.some((item) => {
        if (typeof item === 'string' && typeof argument === 'string') {
          return item.toLowerCase() === argument.toLowerCase();
        }
        return item === argument;
      });
    }
    return false;
  },
};

/**
 * #exists - Check if value is defined and not empty
 *
 * @example {{user.preferences}} #exists
 */
export const existsOperator: OperatorDefinition = {
  type: 'unary',
  description: 'Check if variable is defined and not empty',
  example: '{{user.preferences}} #exists',
  autocomplete: {
    trigger: '#ex',
    snippet: '#exists',
  },
  handler: (value: unknown): boolean => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  },
};

/**
 * #matches - Regex pattern match
 *
 * @example {{email}} #matches(.*@.*)
 */
export const matchesOperator: OperatorDefinition = {
  type: 'comparison',
  description: 'Regex pattern matching',
  example: '{{email}} #matches(.*@.*)',
  autocomplete: {
    trigger: '#mat',
    snippet: '#matches($1)',
  },
  handler: (value: unknown, pattern: unknown): boolean => {
    if (typeof value !== 'string' || typeof pattern !== 'string') {
      return false;
    }
    try {
      const regex = new RegExp(pattern);
      return regex.test(value);
    } catch {
      // Invalid regex pattern
      return false;
    }
  },
};

// =============================================================================
// NUMERIC OPERATORS
// =============================================================================

/**
 * #greater_than - Greater than (alias: #gt)
 *
 * @example {{age}} #greater_than(18)
 */
export const gtOperator: OperatorDefinition = {
  type: 'comparison',
  description: 'Greater than comparison',
  example: '{{age}} #greater_than(18)',
  autocomplete: {
    trigger: '#greater',
    snippet: '#greater_than($1)',
  },
  handler: (value: unknown, threshold: unknown): boolean => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    const thresh = typeof threshold === 'string' ? parseFloat(threshold) : threshold;
    if (typeof num !== 'number' || typeof thresh !== 'number') return false;
    if (isNaN(num) || isNaN(thresh)) return false;
    return num > thresh;
  },
};

/**
 * #greater_than_or_equal - Greater than or equal (alias: #gte)
 */
export const gteOperator: OperatorDefinition = {
  type: 'comparison',
  description: 'Greater than or equal comparison',
  example: '{{age}} #greater_than_or_equal(18)',
  autocomplete: {
    trigger: '#greater_than_or',
    snippet: '#greater_than_or_equal($1)',
  },
  handler: (value: unknown, threshold: unknown): boolean => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    const thresh = typeof threshold === 'string' ? parseFloat(threshold) : threshold;
    if (typeof num !== 'number' || typeof thresh !== 'number') return false;
    if (isNaN(num) || isNaN(thresh)) return false;
    return num >= thresh;
  },
};

/**
 * #less_than - Less than (alias: #lt)
 */
export const ltOperator: OperatorDefinition = {
  type: 'comparison',
  description: 'Less than comparison',
  example: '{{count}} #less_than(10)',
  autocomplete: {
    trigger: '#less',
    snippet: '#less_than($1)',
  },
  handler: (value: unknown, threshold: unknown): boolean => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    const thresh = typeof threshold === 'string' ? parseFloat(threshold) : threshold;
    if (typeof num !== 'number' || typeof thresh !== 'number') return false;
    if (isNaN(num) || isNaN(thresh)) return false;
    return num < thresh;
  },
};

/**
 * #less_than_or_equal - Less than or equal (alias: #lte)
 */
export const lteOperator: OperatorDefinition = {
  type: 'comparison',
  description: 'Less than or equal comparison',
  example: '{{count}} #less_than_or_equal(10)',
  autocomplete: {
    trigger: '#less_than_or',
    snippet: '#less_than_or_equal($1)',
  },
  handler: (value: unknown, threshold: unknown): boolean => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    const thresh = typeof threshold === 'string' ? parseFloat(threshold) : threshold;
    if (typeof num !== 'number' || typeof thresh !== 'number') return false;
    if (isNaN(num) || isNaN(thresh)) return false;
    return num <= thresh;
  },
};

// =============================================================================
// LIST OPERATORS
// =============================================================================

/**
 * #one_of - Check if value is in a list (alias: #in)
 *
 * @example {{status}} #one_of(active,pending,completed)
 */
export const inOperator: OperatorDefinition = {
  type: 'comparison',
  description: 'Check if value is one of the given options',
  example: '{{status}} #one_of(active,pending,completed)',
  autocomplete: {
    trigger: '#one',
    snippet: '#one_of($1)',
  },
  handler: (value: unknown, list: unknown): boolean => {
    // List can be passed as array or comma-separated string
    let items: unknown[];
    if (Array.isArray(list)) {
      items = list;
    } else if (typeof list === 'string') {
      items = list.split(',').map((s) => s.trim());
    } else {
      return false;
    }

    // Check if value is in list
    const valueStr = String(value).toLowerCase();
    return items.some((item) => String(item).toLowerCase() === valueStr);
  },
};

// =============================================================================
// AI OPERATOR (ASYNC)
// =============================================================================

/**
 * #ai_judge - LLM-evaluated boolean condition
 *
 * This operator queries an LLM to evaluate a boolean condition.
 * It's async and results are cached for performance.
 *
 * @example {{content}} #ai_judge(Is this appropriate for children?)
 */
export const aiJudgeOperator: OperatorDefinition = {
  type: 'ai',
  description: 'LLM-evaluated boolean condition',
  example: '{{content}} #ai_judge(Is this appropriate for children?)',
  autocomplete: {
    trigger: '#ai',
    snippet: '#ai_judge($1)',
  },
  handler: async (_value: unknown, _question: unknown): Promise<boolean> => {
    // TODO: Implement AI judge
    //
    // IMPLEMENTATION STEPS:
    // 1. Get the AI provider from context (passed via closure or config)
    // 2. Construct prompt asking for yes/no answer
    // 3. Call the AI provider
    // 4. Parse response as boolean
    // 5. Cache result for identical value+question combinations
    //
    // PROMPT TEMPLATE:
    // "Given the following value: {value}
    //  Answer this question with only 'yes' or 'no':
    //  {question}"
    //
    // CACHING:
    // Cache key = hash(value + question)
    // Cache should be per-render to avoid stale data across renders

    throw new Error(
      'AI Judge not implemented. Configure aiProvider in EchoConfig.'
    );
  },
};

// =============================================================================
// OPERATOR REGISTRY
// =============================================================================

/**
 * All built-in operators.
 *
 * Operators have readable names for low-coders and short aliases for developers.
 * Both forms work identically:
 *   - #greater_than(10) or #gt(10)
 *   - #one_of(a,b,c) or #in(a,b,c)
 */
export const builtinOperators: Record<string, OperatorDefinition> = {
  // Comparison operators (readable names)
  equals: equalsOperator,
  contains: containsOperator,
  exists: existsOperator,
  matches: matchesOperator,
  greater_than: gtOperator,
  greater_than_or_equal: gteOperator,
  less_than: ltOperator,
  less_than_or_equal: lteOperator,
  one_of: inOperator,
  ai_judge: aiJudgeOperator,

  // Short aliases for developers
  gt: gtOperator,
  gte: gteOperator,
  lt: ltOperator,
  lte: lteOperator,
  in: inOperator,
};

/**
 * Get an operator by name.
 *
 * @param name - The operator name (without #)
 * @returns The operator definition or undefined
 */
export function getOperator(name: string): OperatorDefinition | undefined {
  return builtinOperators[name];
}

/**
 * Check if an operator is async (AI-based).
 *
 * @param name - The operator name
 * @returns true if the operator is async
 */
export function isAsyncOperator(name: string): boolean {
  const op = getOperator(name);
  return op?.type === 'ai';
}

// =============================================================================
// IMPLEMENTATION NOTES
// =============================================================================

/*
NEXT STEPS TO IMPLEMENT:

1. AI JUDGE IMPLEMENTATION
   - Create ai-judge/provider.ts for AI provider abstraction
   - Implement OpenAI adapter
   - Add caching layer
   - Handle timeouts and errors gracefully

2. OPERATOR CONTEXT
   The ai_judge operator needs access to the AI provider.
   Options:
   - Pass context as third argument to handler
   - Use closure to capture config
   - Create factory function that returns configured handler

3. ERROR HANDLING
   - Invalid regex in #matches should not crash
   - Type mismatches should return false (not throw)
   - AI errors should be recoverable

4. TESTS
   Create operators.test.ts with tests for:
   - Each operator with various inputs
   - Edge cases (null, undefined, empty)
   - Type coercion behavior
   - Async operator mocking
*/
