/**
 * @fileoverview Unit tests for the Echo DSL evaluator
 */

import { describe, it, expect } from 'vitest';
import {
  resolveVariable,
  evaluate,
  evaluateConditional,
  createEvaluationContext,
} from './evaluator.js';
import {
  createTextNode,
  createVariableNode,
  createConditionalNode,
  createConditionExpr,
  createSectionNode,
  createIncludeNode,
} from '../parser/ast.js';
import type { SourceLocation } from '../types.js';

const defaultLocation: SourceLocation = {
  startLine: 1,
  startColumn: 1,
  endLine: 1,
  endColumn: 1,
};

describe('resolveVariable', () => {
  it('should resolve simple variable', () => {
    const context = { name: 'Alice' };
    expect(resolveVariable('name', context)).toBe('Alice');
  });

  it('should resolve nested path', () => {
    const context = { user: { profile: { name: 'Alice' } } };
    expect(resolveVariable('user.profile.name', context)).toBe('Alice');
  });

  it('should resolve array access', () => {
    const context = { items: ['a', 'b', 'c'] };
    expect(resolveVariable('items[0]', context)).toBe('a');
    expect(resolveVariable('items[1]', context)).toBe('b');
    expect(resolveVariable('items[2]', context)).toBe('c');
  });

  it('should resolve mixed path with array and property', () => {
    const context = {
      users: [
        { name: 'Alice' },
        { name: 'Bob' },
      ],
    };
    expect(resolveVariable('users[0].name', context)).toBe('Alice');
    expect(resolveVariable('users[1].name', context)).toBe('Bob');
  });

  it('should return undefined for missing property', () => {
    const context = { name: 'Alice' };
    expect(resolveVariable('age', context)).toBeUndefined();
    expect(resolveVariable('user.name', context)).toBeUndefined();
  });

  it('should return undefined for out of bounds array', () => {
    const context = { items: ['a', 'b'] };
    expect(resolveVariable('items[10]', context)).toBeUndefined();
  });

  it('should handle null values in path', () => {
    const context = { user: null };
    expect(resolveVariable('user.name', context)).toBeUndefined();
  });

  describe('strict mode validation', () => {
    it('should throw for empty brackets in strict mode', () => {
      const context = { items: ['a', 'b', 'c'] };
      expect(() => resolveVariable('items[]', context, { strict: true })).toThrow(
        'Invalid array access "[]" in path "items[]". Array index must be a non-negative integer.'
      );
    });

    it('should throw for non-numeric index in strict mode', () => {
      const context = { items: ['a', 'b', 'c'] };
      expect(() => resolveVariable('items[abc]', context, { strict: true })).toThrow(
        'Invalid array access "[abc]" in path "items[abc]". Array index must be a non-negative integer.'
      );
    });

    it('should throw for negative index in strict mode', () => {
      const context = { items: ['a', 'b', 'c'] };
      expect(() => resolveVariable('items[-1]', context, { strict: true })).toThrow(
        'Invalid array access "[-1]" in path "items[-1]". Negative indices are not supported.'
      );
    });

    it('should throw for unclosed brackets in strict mode', () => {
      const context = { items: ['a', 'b', 'c'] };
      expect(() => resolveVariable('items[0', context, { strict: true })).toThrow(
        'Malformed array access in path "items[0". Unclosed or unmatched brackets.'
      );
    });

    it('should throw when accessing index on non-array in strict mode', () => {
      const context = { name: 'Alice' };
      expect(() => resolveVariable('name[0]', context, { strict: true })).toThrow(
        'Cannot access index [0] on non-array value in path "name[0]"'
      );
    });

    it('should return undefined for malformed patterns in lenient mode', () => {
      const context = { items: ['a', 'b', 'c'] };
      // In lenient mode (default), these should return undefined without throwing
      expect(resolveVariable('items[]', context)).toBeUndefined();
      expect(resolveVariable('items[abc]', context)).toBeUndefined();
      expect(resolveVariable('items[-1]', context)).toBeUndefined();
    });

    it('should work correctly with valid patterns in strict mode', () => {
      const context = {
        items: ['a', 'b', 'c'],
        users: [{ name: 'Alice' }],
      };
      expect(resolveVariable('items[0]', context, { strict: true })).toBe('a');
      expect(resolveVariable('users[0].name', context, { strict: true })).toBe('Alice');
    });
  });
});

describe('evaluateConditional', () => {
  it('should return consequent when condition is true', async () => {
    const ctx = createEvaluationContext({
      variables: { x: 'hello' },
    });

    const node = createConditionalNode(
      createConditionExpr('x', 'exists'),
      [createTextNode('yes', defaultLocation)],
      defaultLocation
    );

    const result = await evaluateConditional(node, ctx);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
    if (result[0].type === 'text') {
      expect(result[0].value).toBe('yes');
    }
  });

  it('should return empty when condition is false and no alternate', async () => {
    const ctx = createEvaluationContext({
      variables: { x: '' },
    });

    const node = createConditionalNode(
      createConditionExpr('x', 'exists'),
      [createTextNode('yes', defaultLocation)],
      defaultLocation
    );

    const result = await evaluateConditional(node, ctx);
    expect(result).toHaveLength(0);
  });

  it('should return alternate when condition is false', async () => {
    const ctx = createEvaluationContext({
      variables: { x: '' },
    });

    const node = createConditionalNode(
      createConditionExpr('x', 'exists'),
      [createTextNode('yes', defaultLocation)],
      defaultLocation,
      [createTextNode('no', defaultLocation)]
    );

    const result = await evaluateConditional(node, ctx);
    expect(result).toHaveLength(1);
    if (result[0].type === 'text') {
      expect(result[0].value).toBe('no');
    }
  });

  it('should handle nested ELSE IF', async () => {
    const ctx = createEvaluationContext({
      variables: { x: 'b' },
    });

    // [#IF {{x}} #equals(a)]A[ELSE IF {{x}} #equals(b)]B[ELSE]C[END IF]
    const elseIfNode = createConditionalNode(
      createConditionExpr('x', 'equals', 'b'),
      [createTextNode('B', defaultLocation)],
      defaultLocation,
      [createTextNode('C', defaultLocation)]
    );

    const node = createConditionalNode(
      createConditionExpr('x', 'equals', 'a'),
      [createTextNode('A', defaultLocation)],
      defaultLocation,
      elseIfNode
    );

    const result = await evaluateConditional(node, ctx);
    expect(result).toHaveLength(1);
    if (result[0].type === 'text') {
      expect(result[0].value).toBe('B');
    }
  });
});

describe('evaluate', () => {
  it('should pass through text nodes', async () => {
    const ast = [createTextNode('Hello world', defaultLocation)];
    const result = await evaluate(ast, {});

    expect(result.ast).toHaveLength(1);
    expect(result.ast[0].type).toBe('text');
  });

  it('should pass through variable nodes', async () => {
    const ast = [createVariableNode('name', defaultLocation)];
    const result = await evaluate(ast, { name: 'Alice' });

    expect(result.ast).toHaveLength(1);
    expect(result.ast[0].type).toBe('variable');
  });

  it('should evaluate conditionals and flatten selected branch', async () => {
    const ast = [
      createConditionalNode(
        createConditionExpr('show', 'exists'),
        [createTextNode('visible', defaultLocation)],
        defaultLocation,
        [createTextNode('hidden', defaultLocation)]
      ),
    ];

    const result1 = await evaluate(ast, { show: true });
    expect(result1.ast).toHaveLength(1);
    if (result1.ast[0].type === 'text') {
      expect(result1.ast[0].value).toBe('visible');
    }

    const result2 = await evaluate(ast, { show: '' });
    expect(result2.ast).toHaveLength(1);
    if (result2.ast[0].type === 'text') {
      expect(result2.ast[0].value).toBe('hidden');
    }
  });

  it('should collect sections and not include them in output', async () => {
    const ast = [
      createSectionNode(
        'header',
        [createTextNode('Header content', defaultLocation)],
        defaultLocation
      ),
      createTextNode('Main content', defaultLocation),
    ];

    const result = await evaluate(ast, {});

    // Section should not appear in output
    expect(result.ast).toHaveLength(1);
    expect(result.ast[0].type).toBe('text');

    // But should be in sections map
    expect(result.sections.has('header')).toBe(true);
  });

  it('should resolve includes from sections', async () => {
    const ast = [
      createSectionNode(
        'greeting',
        [createTextNode('Hello!', defaultLocation)],
        defaultLocation
      ),
      createIncludeNode('greeting', defaultLocation),
    ];

    const result = await evaluate(ast, {});

    // Should have the included content
    expect(result.ast).toHaveLength(1);
    expect(result.ast[0].type).toBe('text');
    if (result.ast[0].type === 'text') {
      expect(result.ast[0].value).toBe('Hello!');
    }
  });

  it('should handle nested conditionals', async () => {
    const innerConditional = createConditionalNode(
      createConditionExpr('y', 'exists'),
      [createTextNode('inner', defaultLocation)],
      defaultLocation
    );

    const outerConditional = createConditionalNode(
      createConditionExpr('x', 'exists'),
      [createTextNode('outer-', defaultLocation), innerConditional],
      defaultLocation
    );

    const ast = [outerConditional];
    const result = await evaluate(ast, { x: true, y: true });

    expect(result.ast).toHaveLength(2);
    if (result.ast[0].type === 'text' && result.ast[1].type === 'text') {
      expect(result.ast[0].value).toBe('outer-');
      expect(result.ast[1].value).toBe('inner');
    }
  });

  it('should handle unknown operators in lenient mode', async () => {
    const ast = [
      createConditionalNode(
        createConditionExpr('x', 'unknownOperator'),
        [createTextNode('yes', defaultLocation)],
        defaultLocation,
        [createTextNode('no', defaultLocation)]
      ),
    ];

    const result = await evaluate(ast, { x: 'value' }, { strict: false });

    // Should default to false for unknown operator
    expect(result.ast).toHaveLength(1);
    if (result.ast[0].type === 'text') {
      expect(result.ast[0].value).toBe('no');
    }
  });

  it('should throw for unknown operators in strict mode', async () => {
    const ast = [
      createConditionalNode(
        createConditionExpr('x', 'unknownOperator'),
        [createTextNode('yes', defaultLocation)],
        defaultLocation
      ),
    ];

    await expect(evaluate(ast, { x: 'value' }, { strict: true })).rejects.toThrow(
      'Unknown operator'
    );
  });
});
