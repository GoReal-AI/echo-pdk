/**
 * @fileoverview Unit tests for the Echo renderer
 */

import { describe, it, expect } from 'vitest';
import { render, renderTemplate, formatErrors } from './renderer.js';
import {
  createTextNode,
  createVariableNode,
  createSectionNode,
  createImportNode,
  createIncludeNode,
} from '../parser/ast.js';
import type { SourceLocation } from '../types.js';

const defaultLocation: SourceLocation = {
  startLine: 1,
  startColumn: 1,
  endLine: 1,
  endColumn: 1,
};

describe('render', () => {
  describe('text nodes', () => {
    it('should render text nodes as-is', () => {
      const ast = [createTextNode('Hello world', defaultLocation)];
      const result = render(ast, { context: {} });
      expect(result).toBe('Hello world');
    });

    it('should render multiple text nodes', () => {
      const ast = [
        createTextNode('Hello ', defaultLocation),
        createTextNode('world', defaultLocation),
      ];
      const result = render(ast, { context: {} });
      expect(result).toBe('Hello world');
    });

    it('should preserve whitespace', () => {
      const ast = [createTextNode('  Hello  \n  world  ', defaultLocation)];
      const result = render(ast, { context: {} });
      expect(result).toBe('  Hello  \n  world  ');
    });
  });

  describe('variable nodes', () => {
    it('should render variable with value from context', () => {
      const ast = [createVariableNode('name', defaultLocation)];
      const result = render(ast, { context: { name: 'Alice' } });
      expect(result).toBe('Alice');
    });

    it('should render nested variable path', () => {
      const ast = [createVariableNode('user.name', defaultLocation)];
      const result = render(ast, { context: { user: { name: 'Alice' } } });
      expect(result).toBe('Alice');
    });

    it('should render variable with default when value is undefined', () => {
      const ast = [createVariableNode('name', defaultLocation, 'Guest')];
      const result = render(ast, { context: {} });
      expect(result).toBe('Guest');
    });

    it('should render empty string for undefined variable in lenient mode', () => {
      const ast = [createVariableNode('name', defaultLocation)];
      const result = render(ast, { context: {}, config: { strict: false } });
      expect(result).toBe('');
    });

    it('should throw for undefined variable in strict mode', () => {
      const ast = [createVariableNode('name', defaultLocation)];
      expect(() =>
        render(ast, { context: {}, config: { strict: true } })
      ).toThrow('Undefined variable: name');
    });

    it('should stringify numbers', () => {
      const ast = [createVariableNode('count', defaultLocation)];
      const result = render(ast, { context: { count: 42 } });
      expect(result).toBe('42');
    });

    it('should stringify booleans', () => {
      const ast = [createVariableNode('active', defaultLocation)];
      const result = render(ast, { context: { active: true } });
      expect(result).toBe('true');
    });

    it('should stringify arrays as comma-separated list', () => {
      const ast = [createVariableNode('items', defaultLocation)];
      const result = render(ast, { context: { items: ['a', 'b', 'c'] } });
      expect(result).toBe('a, b, c');
    });

    it('should stringify objects as JSON', () => {
      const ast = [createVariableNode('user', defaultLocation)];
      const result = render(ast, { context: { user: { name: 'Alice', age: 30 } } });
      expect(result).toBe('{"name":"Alice","age":30}');
    });
  });

  describe('section nodes', () => {
    it('should not render section definitions inline', () => {
      const ast = [
        createSectionNode(
          'header',
          [createTextNode('Header content', defaultLocation)],
          defaultLocation
        ),
        createTextNode('Main content', defaultLocation),
      ];
      const result = render(ast, { context: {} });
      expect(result).toBe('Main content');
    });
  });

  describe('import nodes', () => {
    it('should skip unresolved imports in lenient mode', () => {
      const ast = [
        createImportNode('./header.echo', defaultLocation),
        createTextNode('Main content', defaultLocation),
      ];
      const result = render(ast, { context: {}, config: { strict: false } });
      expect(result).toBe('Main content');
    });

    it('should throw for unresolved imports in strict mode', () => {
      const ast = [createImportNode('./header.echo', defaultLocation)];
      expect(() =>
        render(ast, { context: {}, config: { strict: true } })
      ).toThrow('Unresolved import: ./header.echo');
    });
  });

  describe('include nodes', () => {
    it('should skip unresolved includes in lenient mode', () => {
      const ast = [
        createIncludeNode('header', defaultLocation),
        createTextNode('Main content', defaultLocation),
      ];
      const result = render(ast, { context: {}, config: { strict: false } });
      expect(result).toBe('Main content');
    });

    it('should throw for unresolved includes in strict mode', () => {
      const ast = [createIncludeNode('header', defaultLocation)];
      expect(() =>
        render(ast, { context: {}, config: { strict: true } })
      ).toThrow('Unresolved include: header');
    });
  });

  describe('post-processing', () => {
    it('should collapse multiple newlines when option is set', () => {
      const ast = [createTextNode('Line 1\n\n\n\n\nLine 2', defaultLocation)];
      const result = render(ast, { context: {}, collapseNewlines: true });
      expect(result).toBe('Line 1\n\nLine 2');
    });

    it('should trim whitespace when option is set', () => {
      const ast = [createTextNode('  Hello world  ', defaultLocation)];
      const result = render(ast, { context: {}, trim: true });
      expect(result).toBe('Hello world');
    });

    it('should apply both collapseNewlines and trim', () => {
      const ast = [createTextNode('\n\n\nHello\n\n\n\nworld\n\n\n', defaultLocation)];
      const result = render(ast, { context: {}, collapseNewlines: true, trim: true });
      expect(result).toBe('Hello\n\nworld');
    });
  });
});

describe('renderTemplate', () => {
  it('should render simple template', async () => {
    const result = await renderTemplate('Hello world', {});
    expect(result).toBe('Hello world');
  });

  it('should render template with variable', async () => {
    const result = await renderTemplate('Hello {{name}}!', { name: 'Alice' });
    expect(result).toBe('Hello Alice!');
  });

  it('should render template with conditional', async () => {
    const template = '[#IF {{show}} #exists]visible[ELSE]hidden[END IF]';

    const result1 = await renderTemplate(template, { show: true });
    expect(result1).toBe('visible');

    const result2 = await renderTemplate(template, { show: '' });
    expect(result2).toBe('hidden');
  });

  it('should render template with section and include', async () => {
    const template = `[#SECTION name="greeting"]Hello![END SECTION][#INCLUDE greeting]`;
    const result = await renderTemplate(template, {});
    expect(result).toBe('Hello!');
  });

  it('should throw on parse error', async () => {
    await expect(renderTemplate('Hello {{name', {})).rejects.toThrow('Parse error');
  });
});

describe('formatErrors', () => {
  it('should format error with location', () => {
    const template = 'Hello {{name';
    const errors = [
      {
        message: 'Unclosed variable',
        location: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 7 },
      },
    ];

    const formatted = formatErrors(template, errors);

    expect(formatted).toContain('Error: Unclosed variable');
    expect(formatted).toContain('1 | Hello {{name');
    expect(formatted).toContain('^');
  });

  it('should format error without location', () => {
    const template = 'Hello world';
    const errors = [{ message: 'Some error' }];

    const formatted = formatErrors(template, errors);

    expect(formatted).toContain('Error: Some error');
    expect(formatted).not.toContain('|');
  });

  it('should handle multi-line template', () => {
    const template = 'Line 1\nLine 2\nLine 3';
    const errors = [
      {
        message: 'Error on line 2',
        location: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 1 },
      },
    ];

    const formatted = formatErrors(template, errors);

    expect(formatted).toContain('2 | Line 2');
  });
});
