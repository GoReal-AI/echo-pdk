/**
 * @fileoverview Unit tests for built-in operators
 */

import { describe, it, expect } from 'vitest';
import {
  equalsOperator,
  containsOperator,
  existsOperator,
  matchesOperator,
  gtOperator,
  gteOperator,
  ltOperator,
  lteOperator,
  inOperator,
  getOperator,
  isAsyncOperator,
} from './operators.js';

describe('equalsOperator', () => {
  it('should return true for exact string match (case-insensitive)', () => {
    expect(equalsOperator.handler('Horror', 'horror')).toBe(true);
    expect(equalsOperator.handler('HORROR', 'horror')).toBe(true);
    expect(equalsOperator.handler('horror', 'Horror')).toBe(true);
  });

  it('should return false for non-matching strings', () => {
    expect(equalsOperator.handler('Horror', 'Comedy')).toBe(false);
  });

  it('should handle non-string types with strict equality', () => {
    expect(equalsOperator.handler(42, 42)).toBe(true);
    expect(equalsOperator.handler(42, '42')).toBe(false);
    expect(equalsOperator.handler(true, true)).toBe(true);
    expect(equalsOperator.handler(true, false)).toBe(false);
  });

  it('should handle null and undefined', () => {
    expect(equalsOperator.handler(null, null)).toBe(true);
    expect(equalsOperator.handler(undefined, undefined)).toBe(true);
    expect(equalsOperator.handler(null, undefined)).toBe(false);
  });
});

describe('containsOperator', () => {
  it('should check if string contains substring (case-insensitive)', () => {
    expect(containsOperator.handler('Hello World', 'world')).toBe(true);
    expect(containsOperator.handler('Hello World', 'HELLO')).toBe(true);
    expect(containsOperator.handler('Hello World', 'foo')).toBe(false);
  });

  it('should check if array contains value (case-insensitive for strings)', () => {
    expect(containsOperator.handler(['Alice', 'Bob', 'Charlie'], 'bob')).toBe(true);
    expect(containsOperator.handler(['Alice', 'Bob', 'Charlie'], 'BOB')).toBe(true);
    expect(containsOperator.handler(['Alice', 'Bob', 'Charlie'], 'Dave')).toBe(false);
  });

  it('should handle array with non-string values', () => {
    expect(containsOperator.handler([1, 2, 3], 2)).toBe(true);
    expect(containsOperator.handler([1, 2, 3], 4)).toBe(false);
  });

  it('should return false for non-string/non-array values', () => {
    expect(containsOperator.handler(42, 4)).toBe(false);
    expect(containsOperator.handler(null, 'test')).toBe(false);
  });
});

describe('existsOperator', () => {
  it('should return false for undefined and null', () => {
    expect(existsOperator.handler(undefined)).toBe(false);
    expect(existsOperator.handler(null)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(existsOperator.handler('')).toBe(false);
  });

  it('should return true for non-empty string', () => {
    expect(existsOperator.handler('hello')).toBe(true);
    expect(existsOperator.handler(' ')).toBe(true);
  });

  it('should return false for empty array', () => {
    expect(existsOperator.handler([])).toBe(false);
  });

  it('should return true for non-empty array', () => {
    expect(existsOperator.handler([1, 2, 3])).toBe(true);
    expect(existsOperator.handler([null])).toBe(true);
  });

  it('should return false for empty object', () => {
    expect(existsOperator.handler({})).toBe(false);
  });

  it('should return true for non-empty object', () => {
    expect(existsOperator.handler({ key: 'value' })).toBe(true);
  });

  it('should return true for numbers (including 0)', () => {
    expect(existsOperator.handler(0)).toBe(true);
    expect(existsOperator.handler(42)).toBe(true);
    expect(existsOperator.handler(-1)).toBe(true);
  });

  it('should return true for booleans', () => {
    expect(existsOperator.handler(true)).toBe(true);
    expect(existsOperator.handler(false)).toBe(true);
  });
});

describe('matchesOperator', () => {
  it('should match regex patterns', () => {
    expect(matchesOperator.handler('test@example.com', '.*@.*')).toBe(true);
    expect(matchesOperator.handler('hello123', '\\d+')).toBe(true);
    expect(matchesOperator.handler('hello', '\\d+')).toBe(false);
  });

  it('should handle anchored patterns', () => {
    expect(matchesOperator.handler('hello', '^hello$')).toBe(true);
    expect(matchesOperator.handler('hello world', '^hello$')).toBe(false);
  });

  it('should return false for invalid regex', () => {
    expect(matchesOperator.handler('test', '[invalid')).toBe(false);
  });

  it('should return false for non-string values', () => {
    expect(matchesOperator.handler(42, '\\d+')).toBe(false);
    expect(matchesOperator.handler(null, 'test')).toBe(false);
  });
});

describe('gtOperator (greater than)', () => {
  it('should compare numbers', () => {
    expect(gtOperator.handler(10, 5)).toBe(true);
    expect(gtOperator.handler(5, 10)).toBe(false);
    expect(gtOperator.handler(5, 5)).toBe(false);
  });

  it('should handle string numbers', () => {
    expect(gtOperator.handler('10', '5')).toBe(true);
    expect(gtOperator.handler('10', 5)).toBe(true);
    expect(gtOperator.handler(10, '5')).toBe(true);
  });

  it('should return false for NaN', () => {
    expect(gtOperator.handler('abc', 5)).toBe(false);
    expect(gtOperator.handler(10, 'abc')).toBe(false);
  });

  it('should handle negative numbers', () => {
    expect(gtOperator.handler(-5, -10)).toBe(true);
    expect(gtOperator.handler(-10, -5)).toBe(false);
  });

  it('should handle decimals', () => {
    expect(gtOperator.handler(3.14, 3)).toBe(true);
    expect(gtOperator.handler(3, 3.14)).toBe(false);
  });
});

describe('gteOperator (greater than or equal)', () => {
  it('should compare numbers', () => {
    expect(gteOperator.handler(10, 5)).toBe(true);
    expect(gteOperator.handler(5, 5)).toBe(true);
    expect(gteOperator.handler(5, 10)).toBe(false);
  });
});

describe('ltOperator (less than)', () => {
  it('should compare numbers', () => {
    expect(ltOperator.handler(5, 10)).toBe(true);
    expect(ltOperator.handler(10, 5)).toBe(false);
    expect(ltOperator.handler(5, 5)).toBe(false);
  });
});

describe('lteOperator (less than or equal)', () => {
  it('should compare numbers', () => {
    expect(lteOperator.handler(5, 10)).toBe(true);
    expect(lteOperator.handler(5, 5)).toBe(true);
    expect(lteOperator.handler(10, 5)).toBe(false);
  });
});

describe('inOperator', () => {
  it('should check if value is in array', () => {
    expect(inOperator.handler('active', ['active', 'pending', 'completed'])).toBe(true);
    expect(inOperator.handler('deleted', ['active', 'pending', 'completed'])).toBe(false);
  });

  it('should handle comma-separated string as list', () => {
    expect(inOperator.handler('active', 'active,pending,completed')).toBe(true);
    expect(inOperator.handler('deleted', 'active,pending,completed')).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(inOperator.handler('ACTIVE', ['active', 'pending'])).toBe(true);
    expect(inOperator.handler('active', 'ACTIVE,PENDING')).toBe(true);
  });

  it('should handle numeric values', () => {
    expect(inOperator.handler(1, [1, 2, 3])).toBe(true);
    expect(inOperator.handler('1', [1, 2, 3])).toBe(true);
  });
});

describe('getOperator', () => {
  it('should return the operator definition by name', () => {
    expect(getOperator('equals')).toBe(equalsOperator);
    expect(getOperator('contains')).toBe(containsOperator);
    expect(getOperator('exists')).toBe(existsOperator);
  });

  it('should return undefined for unknown operators', () => {
    expect(getOperator('unknown')).toBeUndefined();
  });
});

describe('isAsyncOperator', () => {
  it('should return true for ai_gate operator', () => {
    expect(isAsyncOperator('ai_gate')).toBe(true);
  });

  it('should return true for deprecated ai_judge operator', () => {
    expect(isAsyncOperator('ai_judge')).toBe(true);
  });

  it('should return false for sync operators', () => {
    expect(isAsyncOperator('equals')).toBe(false);
    expect(isAsyncOperator('contains')).toBe(false);
    expect(isAsyncOperator('exists')).toBe(false);
  });

  it('should return false for unknown operators', () => {
    expect(isAsyncOperator('unknown')).toBe(false);
  });
});
