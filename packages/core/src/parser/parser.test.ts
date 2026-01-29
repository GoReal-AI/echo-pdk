/**
 * @fileoverview Unit tests for the Echo DSL parser
 */

import { describe, it, expect } from 'vitest';
import { parse } from './parser.js';

describe('parser', () => {
  describe('basic parsing', () => {
    it('should parse empty template', () => {
      const result = parse('');
      expect(result.success).toBe(true);
      expect(result.ast).toHaveLength(0);
    });

    it('should parse plain text', () => {
      const result = parse('Hello world');
      expect(result.success).toBe(true);
      expect(result.ast).toHaveLength(1);
      expect(result.ast?.[0].type).toBe('text');
      if (result.ast?.[0].type === 'text') {
        expect(result.ast[0].value).toBe('Hello world');
      }
    });
  });

  describe('variable parsing', () => {
    it('should parse simple variable', () => {
      const result = parse('{{name}}');
      expect(result.success).toBe(true);
      expect(result.ast).toHaveLength(1);
      expect(result.ast?.[0].type).toBe('variable');
      if (result.ast?.[0].type === 'variable') {
        expect(result.ast[0].path).toBe('name');
      }
    });

    it('should parse nested variable path', () => {
      const result = parse('{{user.profile.name}}');
      expect(result.success).toBe(true);
      expect(result.ast?.[0].type).toBe('variable');
      if (result.ast?.[0].type === 'variable') {
        expect(result.ast[0].path).toBe('user.profile.name');
      }
    });

    it('should parse variable with default value', () => {
      const result = parse('{{name ?? "Guest"}}');
      expect(result.success).toBe(true);
      expect(result.ast?.[0].type).toBe('variable');
      if (result.ast?.[0].type === 'variable') {
        expect(result.ast[0].path).toBe('name');
        expect(result.ast[0].defaultValue).toBe('Guest');
      }
    });

    it('should parse text with embedded variables', () => {
      const result = parse('Hello {{name}}!');
      expect(result.success).toBe(true);
      expect(result.ast).toHaveLength(3);
      expect(result.ast?.[0].type).toBe('text');
      expect(result.ast?.[1].type).toBe('variable');
      expect(result.ast?.[2].type).toBe('text');
    });
  });

  describe('conditional parsing', () => {
    it('should parse simple IF...END IF', () => {
      const result = parse('[#IF {{x}} #exists]content[END IF]');
      expect(result.success).toBe(true);
      expect(result.ast).toHaveLength(1);
      expect(result.ast?.[0].type).toBe('conditional');
      if (result.ast?.[0].type === 'conditional') {
        expect(result.ast[0].condition.variable).toBe('x');
        expect(result.ast[0].condition.operator).toBe('exists');
        expect(result.ast[0].consequent).toHaveLength(1);
      }
    });

    it('should parse IF with operator argument', () => {
      const result = parse('[#IF {{age}} #gt(18)]Adult[END IF]');
      expect(result.success).toBe(true);
      if (result.ast?.[0].type === 'conditional') {
        expect(result.ast[0].condition.operator).toBe('gt');
        expect(result.ast[0].condition.argument).toBe(18);
      }
    });

    it('should parse IF with string argument', () => {
      const result = parse('[#IF {{genre}} #equals("Horror")]scary[END IF]');
      expect(result.success).toBe(true);
      if (result.ast?.[0].type === 'conditional') {
        expect(result.ast[0].condition.operator).toBe('equals');
        expect(result.ast[0].condition.argument).toBe('Horror');
      }
    });

    it('should parse IF...ELSE...END IF', () => {
      const result = parse('[#IF {{x}} #exists]yes[ELSE]no[END IF]');
      expect(result.success).toBe(true);
      if (result.ast?.[0].type === 'conditional') {
        expect(result.ast[0].consequent).toHaveLength(1);
        expect(Array.isArray(result.ast[0].alternate)).toBe(true);
        if (Array.isArray(result.ast[0].alternate)) {
          expect(result.ast[0].alternate).toHaveLength(1);
        }
      }
    });

    it('should parse IF...ELSE IF...ELSE...END IF', () => {
      const result = parse(
        '[#IF {{x}} #equals(a)]A[ELSE IF {{x}} #equals(b)]B[ELSE]C[END IF]'
      );
      expect(result.success).toBe(true);
      if (result.ast?.[0].type === 'conditional') {
        expect(result.ast[0].condition.argument).toBe('a');

        // alternate should be a ConditionalNode (ELSE IF)
        const alternate = result.ast[0].alternate;
        expect(alternate).toBeDefined();
        expect(!Array.isArray(alternate)).toBe(true);

        if (alternate && !Array.isArray(alternate)) {
          expect(alternate.type).toBe('conditional');
          expect(alternate.condition.argument).toBe('b');

          // The ELSE IF's alternate should be the ELSE block (array)
          expect(Array.isArray(alternate.alternate)).toBe(true);
        }
      }
    });

    it('should detect ai_judge conditions', () => {
      // Note: String arguments with spaces must be quoted
      const result = parse('[#IF {{content}} #ai_judge("Is this safe?")]safe[END IF]');
      expect(result.success).toBe(true);
      if (result.ast?.[0].type === 'conditional') {
        expect(result.ast[0].condition.operator).toBe('ai_judge');
        expect(result.ast[0].condition.isAiJudge).toBe(true);
        expect(result.ast[0].condition.argument).toBe('Is this safe?');
      }
    });

    it('should parse nested conditionals', () => {
      const template = `[#IF {{a}} #exists]outer[#IF {{b}} #exists]inner[END IF][END IF]`;
      const result = parse(template);
      expect(result.success).toBe(true);
      if (result.ast?.[0].type === 'conditional') {
        expect(result.ast[0].consequent.length).toBeGreaterThan(0);
        const innerConditional = result.ast[0].consequent.find(
          (n) => n.type === 'conditional'
        );
        expect(innerConditional).toBeDefined();
      }
    });
  });

  describe('section parsing', () => {
    it('should parse section definition', () => {
      const result = parse('[#SECTION name="header"]Header content[END SECTION]');
      expect(result.success).toBe(true);
      expect(result.ast?.[0].type).toBe('section');
      if (result.ast?.[0].type === 'section') {
        expect(result.ast[0].name).toBe('header');
        expect(result.ast[0].body).toHaveLength(1);
      }
    });
  });

  describe('import/include parsing', () => {
    it('should parse import directive', () => {
      const result = parse('[#IMPORT "./header.echo"]');
      expect(result.success).toBe(true);
      expect(result.ast?.[0].type).toBe('import');
      if (result.ast?.[0].type === 'import') {
        expect(result.ast[0].path).toBe('./header.echo');
      }
    });

    it('should parse include directive', () => {
      const result = parse('[#INCLUDE header]');
      expect(result.success).toBe(true);
      expect(result.ast?.[0].type).toBe('include');
      if (result.ast?.[0].type === 'include') {
        expect(result.ast[0].name).toBe('header');
      }
    });
  });

  describe('context parsing', () => {
    it('should parse simple context reference', () => {
      const result = parse('#context(product-image)');
      expect(result.success).toBe(true);
      expect(result.ast).toHaveLength(1);
      expect(result.ast?.[0].type).toBe('context');
      if (result.ast?.[0].type === 'context') {
        expect(result.ast[0].path).toBe('product-image');
      }
    });

    it('should parse context with plp:// reference', () => {
      const result = parse('#context(plp://logo-v2)');
      expect(result.success).toBe(true);
      expect(result.ast?.[0].type).toBe('context');
      if (result.ast?.[0].type === 'context') {
        expect(result.ast[0].path).toBe('plp://logo-v2');
      }
    });

    it('should parse text with embedded context', () => {
      const result = parse('Image: #context(hero) done');
      expect(result.success).toBe(true);
      expect(result.ast).toHaveLength(3);
      expect(result.ast?.[0].type).toBe('text');
      expect(result.ast?.[1].type).toBe('context');
      expect(result.ast?.[2].type).toBe('text');
    });

    it('should parse multiple context references', () => {
      const result = parse('#context(img1) and #context(img2)');
      expect(result.success).toBe(true);

      const contexts = result.ast?.filter((n) => n.type === 'context');
      expect(contexts).toHaveLength(2);
      if (contexts?.[0].type === 'context' && contexts?.[1].type === 'context') {
        expect(contexts[0].path).toBe('img1');
        expect(contexts[1].path).toBe('img2');
      }
    });

    it('should parse context with variables', () => {
      const result = parse('Hello {{name}}, here is #context(image)');
      expect(result.success).toBe(true);

      const variable = result.ast?.find((n) => n.type === 'variable');
      const context = result.ast?.find((n) => n.type === 'context');
      expect(variable).toBeDefined();
      expect(context).toBeDefined();
    });

    it('should parse context inside conditional', () => {
      const template = '[#IF {{show}} #exists]#context(hero-image)[END IF]';
      const result = parse(template);
      expect(result.success).toBe(true);

      if (result.ast?.[0].type === 'conditional') {
        const contextNode = result.ast[0].consequent.find((n) => n.type === 'context');
        expect(contextNode).toBeDefined();
        if (contextNode?.type === 'context') {
          expect(contextNode.path).toBe('hero-image');
        }
      }
    });

    it('should track source location for context nodes', () => {
      const result = parse('#context(test)');
      expect(result.success).toBe(true);
      expect(result.ast?.[0].location).toBeDefined();
      expect(result.ast?.[0].location.startLine).toBe(1);
      expect(result.ast?.[0].location.startColumn).toBe(1);
    });

    it('should handle empty context gracefully', () => {
      const result = parse('#context()');
      expect(result.success).toBe(true);
      if (result.ast?.[0].type === 'context') {
        expect(result.ast[0].path).toBe('');
      }
    });
  });

  describe('source locations', () => {
    it('should track locations for text nodes', () => {
      const result = parse('Hello');
      expect(result.success).toBe(true);
      expect(result.ast?.[0].location).toBeDefined();
      expect(result.ast?.[0].location.startLine).toBe(1);
      expect(result.ast?.[0].location.startColumn).toBe(1);
    });

    it('should track locations for variable nodes', () => {
      const result = parse('{{name}}');
      expect(result.success).toBe(true);
      expect(result.ast?.[0].location.startLine).toBe(1);
    });

    it('should track locations across multiple lines', () => {
      const result = parse('Line 1\n{{name}}');
      expect(result.success).toBe(true);
      expect(result.ast?.[1].type).toBe('variable');
      expect(result.ast?.[1].location.startLine).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should report error for unclosed variable', () => {
      const result = parse('Hello {{name');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should report error for unclosed conditional', () => {
      const result = parse('[#IF {{x}} #exists]content');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('complex templates', () => {
    it('should parse movie recommender example', () => {
      const template = `You are a movie recommendation assistant.
[#IF {{companions}} #exists]
The user is watching with: {{companions}}.
[END IF]
[#IF {{genre}} #equals("Horror")]
Suggest scary movies.
[ELSE IF {{genre}} #equals("Comedy")]
Suggest funny movies.
[ELSE]
Suggest popular movies.
[END IF]`;

      const result = parse(template);
      expect(result.success).toBe(true);
      expect(result.ast?.length).toBeGreaterThan(0);

      // Should have text nodes and conditional nodes
      const conditionals = result.ast?.filter((n) => n.type === 'conditional');
      expect(conditionals?.length).toBe(2);
    });
  });
});
