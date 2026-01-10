/**
 * @fileoverview Unit tests for the Echo DSL lexer
 */

import { describe, it, expect } from 'vitest';
import { tokenize } from './lexer.js';

describe('lexer', () => {
  describe('basic tokenization', () => {
    it('should tokenize plain text', () => {
      const result = tokenize('Hello world');
      expect(result.errors).toHaveLength(0);
      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0].tokenType.name).toBe('Text');
      expect(result.tokens[0].image).toBe('Hello world');
    });

    it('should tokenize empty string', () => {
      const result = tokenize('');
      expect(result.errors).toHaveLength(0);
      expect(result.tokens).toHaveLength(0);
    });
  });

  describe('variable tokenization', () => {
    it('should tokenize simple variable', () => {
      const result = tokenize('{{name}}');
      expect(result.errors).toHaveLength(0);

      const tokenNames = result.tokens.map((t) => t.tokenType.name);
      // In DEFAULT_MODE, we get VariableOpenDefault (extends VariableOpen category)
      expect(tokenNames).toContain('VariableOpenDefault');
      expect(tokenNames).toContain('Identifier');
      // In VARIABLE_MODE, we get VariableCloseVariable (extends VariableClose category)
      expect(tokenNames).toContain('VariableCloseVariable');
    });

    it('should tokenize variable with default value', () => {
      const result = tokenize('{{name ?? "default"}}');
      expect(result.errors).toHaveLength(0);

      const tokenNames = result.tokens.map((t) => t.tokenType.name);
      expect(tokenNames).toContain('VariableOpenDefault');
      expect(tokenNames).toContain('Identifier');
      expect(tokenNames).toContain('DefaultOp');
      expect(tokenNames).toContain('StringLiteral');
      expect(tokenNames).toContain('VariableCloseVariable');
    });

    it('should tokenize nested variable path', () => {
      const result = tokenize('{{user.profile.name}}');
      expect(result.errors).toHaveLength(0);

      const identifiers = result.tokens.filter((t) => t.tokenType.name === 'Identifier');
      expect(identifiers).toHaveLength(1);
      expect(identifiers[0].image).toBe('user.profile.name');
    });

    it('should tokenize variable with array access', () => {
      const result = tokenize('{{items[0]}}');
      expect(result.errors).toHaveLength(0);

      const identifiers = result.tokens.filter((t) => t.tokenType.name === 'Identifier');
      expect(identifiers).toHaveLength(1);
      expect(identifiers[0].image).toBe('items[0]');
    });

    it('should tokenize text with embedded variable', () => {
      const result = tokenize('Hello {{name}}!');
      expect(result.errors).toHaveLength(0);

      const textTokens = result.tokens.filter((t) => t.tokenType.name === 'Text');
      expect(textTokens).toHaveLength(2);
      expect(textTokens[0].image).toBe('Hello ');
      expect(textTokens[1].image).toBe('!');
    });
  });

  describe('conditional tokenization', () => {
    it('should tokenize simple IF...END IF', () => {
      const result = tokenize('[#IF {{x}} #exists]content[END IF]');
      expect(result.errors).toHaveLength(0);

      const tokenNames = result.tokens.map((t) => t.tokenType.name);
      expect(tokenNames).toContain('IfOpen');
      expect(tokenNames).toContain('Operator');
      expect(tokenNames).toContain('CloseBracket');
      expect(tokenNames).toContain('EndIf');
    });

    it('should tokenize IF with operator argument', () => {
      const result = tokenize('[#IF {{age}} #gt(18)]Adult[END IF]');
      expect(result.errors).toHaveLength(0);

      const tokenNames = result.tokens.map((t) => t.tokenType.name);
      expect(tokenNames).toContain('IfOpen');
      expect(tokenNames).toContain('Operator');
      expect(tokenNames).toContain('LParen');
      expect(tokenNames).toContain('OperatorArgText'); // Now captures "18" as text
      expect(tokenNames).toContain('RParenOperatorArg');
    });

    it('should tokenize IF...ELSE...END IF', () => {
      const result = tokenize('[#IF {{x}} #exists]yes[ELSE]no[END IF]');
      expect(result.errors).toHaveLength(0);

      const tokenNames = result.tokens.map((t) => t.tokenType.name);
      expect(tokenNames).toContain('IfOpen');
      expect(tokenNames).toContain('Else');
      expect(tokenNames).toContain('EndIf');
    });

    it('should tokenize IF...ELSE IF...ELSE...END IF', () => {
      const result = tokenize(
        '[#IF {{x}} #equals(a)]A[ELSE IF {{x}} #equals(b)]B[ELSE]C[END IF]'
      );
      expect(result.errors).toHaveLength(0);

      const tokenNames = result.tokens.map((t) => t.tokenType.name);
      expect(tokenNames).toContain('IfOpen');
      expect(tokenNames).toContain('ElseIf');
      expect(tokenNames).toContain('Else');
      expect(tokenNames).toContain('EndIf');
    });

    it('should tokenize operator with string argument', () => {
      const result = tokenize('[#IF {{genre}} #equals("Horror")]scary[END IF]');
      expect(result.errors).toHaveLength(0);

      // Now operator arguments are captured as OperatorArgText
      const argText = result.tokens.filter((t) => t.tokenType.name === 'OperatorArgText');
      expect(argText).toHaveLength(1);
      expect(argText[0].image).toBe('"Horror"');
    });

    it('should tokenize operator with multiple arguments', () => {
      const result = tokenize('[#IF {{status}} #in(active,pending,completed)]show[END IF]');
      expect(result.errors).toHaveLength(0);

      // Now entire argument list is captured as single OperatorArgText
      const argText = result.tokens.filter((t) => t.tokenType.name === 'OperatorArgText');
      expect(argText).toHaveLength(1);
      expect(argText[0].image).toBe('active,pending,completed');
    });

    it('should tokenize operator with free-form text argument', () => {
      const result = tokenize('[#IF {{companions}} #contains(My Girlfriend)]show[END IF]');
      expect(result.errors).toHaveLength(0);

      // Free-form text with spaces is now supported
      const argText = result.tokens.filter((t) => t.tokenType.name === 'OperatorArgText');
      expect(argText).toHaveLength(1);
      expect(argText[0].image).toBe('My Girlfriend');
    });
  });

  describe('section tokenization', () => {
    it('should tokenize section definition', () => {
      const result = tokenize('[#SECTION name="header"]Header content[END SECTION]');
      expect(result.errors).toHaveLength(0);

      const tokenNames = result.tokens.map((t) => t.tokenType.name);
      expect(tokenNames).toContain('SectionOpen');
      expect(tokenNames).toContain('Identifier');
      expect(tokenNames).toContain('Equals');
      expect(tokenNames).toContain('StringLiteral');
      expect(tokenNames).toContain('EndSection');
    });
  });

  describe('import/include tokenization', () => {
    it('should tokenize import directive', () => {
      const result = tokenize('[#IMPORT "./header.echo"]');
      expect(result.errors).toHaveLength(0);

      const tokenNames = result.tokens.map((t) => t.tokenType.name);
      expect(tokenNames).toContain('Import');
      expect(tokenNames).toContain('StringLiteral');
      expect(tokenNames).toContain('CloseBracket');
    });

    it('should tokenize include directive', () => {
      const result = tokenize('[#INCLUDE header]');
      expect(result.errors).toHaveLength(0);

      const tokenNames = result.tokens.map((t) => t.tokenType.name);
      expect(tokenNames).toContain('Include');
      expect(tokenNames).toContain('Identifier');
      expect(tokenNames).toContain('CloseBracket');
    });
  });

  describe('complex templates', () => {
    it('should tokenize nested conditionals', () => {
      const template = `
[#IF {{user}} #exists]
  Hello {{user.name}}!
  [#IF {{user.isPremium}} #equals(true)]
    Premium content here
  [END IF]
[END IF]`;

      const result = tokenize(template);
      expect(result.errors).toHaveLength(0);

      const ifOpenCount = result.tokens.filter((t) => t.tokenType.name === 'IfOpen').length;
      const endIfCount = result.tokens.filter((t) => t.tokenType.name === 'EndIf').length;
      expect(ifOpenCount).toBe(2);
      expect(endIfCount).toBe(2);
    });

    it('should handle text with brackets that are not directives', () => {
      const result = tokenize('Use brackets like this: [not a directive]');
      expect(result.errors).toHaveLength(0);

      const textTokens = result.tokens.filter((t) => t.tokenType.name === 'Text');
      expect(textTokens.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('position tracking', () => {
    it('should track line and column positions', () => {
      const result = tokenize('Hello\n{{name}}');
      expect(result.errors).toHaveLength(0);

      // Look for VariableOpenDefault (the mode-specific token name)
      const varOpen = result.tokens.find((t) => t.tokenType.name === 'VariableOpenDefault');
      expect(varOpen?.startLine).toBe(2);
      expect(varOpen?.startColumn).toBe(1);
    });
  });
});
