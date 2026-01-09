/**
 * @fileoverview Echo DSL Lexer - Tokenization
 *
 * This file implements the lexer (tokenizer) for Echo DSL using Chevrotain.
 * The lexer converts raw template text into a stream of tokens.
 *
 * IMPLEMENTATION GUIDE:
 *
 * 1. TOKEN DEFINITIONS
 *    Define tokens for each syntax element:
 *    - TEXT: Plain text content (anything not a special syntax)
 *    - VARIABLE_OPEN: {{
 *    - VARIABLE_CLOSE: }}
 *    - IF_OPEN: [#IF
 *    - ELSE_IF: [ELSE IF
 *    - ELSE: [ELSE]
 *    - END_IF: [END IF]
 *    - SECTION_OPEN: [#SECTION
 *    - END_SECTION: [END SECTION]
 *    - IMPORT: [#IMPORT
 *    - INCLUDE: [#INCLUDE
 *    - OPERATOR: #equals, #contains, #exists, #ai_judge, etc.
 *    - IDENTIFIER: variable names, section names
 *    - STRING: quoted strings for arguments
 *    - NUMBER: numeric literals
 *    - LPAREN, RPAREN: ( )
 *    - DEFAULT_OP: ??
 *    - CLOSE_BRACKET: ]
 *
 * 2. LEXER MODES
 *    Use Chevrotain's lexer modes to handle context:
 *    - DEFAULT_MODE: Normal text, looking for special syntax
 *    - VARIABLE_MODE: Inside {{ }}, parsing variable references
 *    - DIRECTIVE_MODE: Inside [#...], parsing directives
 *    - CONDITION_MODE: Parsing condition expressions
 *
 * 3. WHITESPACE HANDLING
 *    - Preserve whitespace in TEXT tokens (important for prompts!)
 *    - Skip whitespace inside directives and conditions
 *
 * 4. ERROR RECOVERY
 *    - Handle unterminated strings
 *    - Handle unclosed {{ or [#
 *    - Provide meaningful error positions
 *
 * EXAMPLE TOKEN STREAM:
 *
 * Input: "Hello {{name}}! [#IF {{age}} #gt(18)]Adult[END IF]"
 *
 * Tokens:
 *   TEXT("Hello ")
 *   VARIABLE_OPEN("{{")
 *   IDENTIFIER("name")
 *   VARIABLE_CLOSE("}}")
 *   TEXT("! ")
 *   IF_OPEN("[#IF")
 *   VARIABLE_OPEN("{{")
 *   IDENTIFIER("age")
 *   VARIABLE_CLOSE("}}")
 *   OPERATOR("#gt")
 *   LPAREN("(")
 *   NUMBER("18")
 *   RPAREN(")")
 *   CLOSE_BRACKET("]")
 *   TEXT("Adult")
 *   END_IF("[END IF]")
 */

import { createToken, Lexer, type TokenType } from 'chevrotain';

// =============================================================================
// TOKEN DEFINITIONS
// =============================================================================

// TODO: Define all tokens here using createToken()
//
// Example:
// export const VariableOpen = createToken({
//   name: 'VariableOpen',
//   pattern: /\{\{/,
//   push_mode: 'variable_mode'
// });

// Placeholder tokens - replace with actual implementation
export const Text = createToken({
  name: 'Text',
  pattern: /[^[{]+/,
});

export const VariableOpen = createToken({
  name: 'VariableOpen',
  pattern: /\{\{/,
});

export const VariableClose = createToken({
  name: 'VariableClose',
  pattern: /\}\}/,
});

export const IfOpen = createToken({
  name: 'IfOpen',
  pattern: /\[#IF/,
});

export const ElseIf = createToken({
  name: 'ElseIf',
  pattern: /\[ELSE IF/,
});

export const Else = createToken({
  name: 'Else',
  pattern: /\[ELSE\]/,
});

export const EndIf = createToken({
  name: 'EndIf',
  pattern: /\[END IF\]/,
});

export const SectionOpen = createToken({
  name: 'SectionOpen',
  pattern: /\[#SECTION/,
});

export const EndSection = createToken({
  name: 'EndSection',
  pattern: /\[END SECTION\]/,
});

export const Import = createToken({
  name: 'Import',
  pattern: /\[#IMPORT/,
});

export const Include = createToken({
  name: 'Include',
  pattern: /\[#INCLUDE/,
});

export const Operator = createToken({
  name: 'Operator',
  pattern: /#[a-zA-Z_][a-zA-Z0-9_]*/,
});

export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_][a-zA-Z0-9_.[\]]*/,
});

export const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"[^"]*"|'[^']*'/,
});

export const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /-?\d+(\.\d+)?/,
});

export const LParen = createToken({
  name: 'LParen',
  pattern: /\(/,
});

export const RParen = createToken({
  name: 'RParen',
  pattern: /\)/,
});

export const CloseBracket = createToken({
  name: 'CloseBracket',
  pattern: /\]/,
});

export const DefaultOp = createToken({
  name: 'DefaultOp',
  pattern: /\?\?/,
});

export const Comma = createToken({
  name: 'Comma',
  pattern: /,/,
});

export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

// =============================================================================
// TOKEN GROUPS
// =============================================================================

/**
 * All tokens in order of priority.
 * Order matters! More specific patterns should come before general ones.
 */
export const allTokens: TokenType[] = [
  // Keywords and directives (most specific first)
  EndIf,
  EndSection,
  ElseIf,
  Else,
  IfOpen,
  SectionOpen,
  Import,
  Include,

  // Variable syntax
  VariableOpen,
  VariableClose,

  // Operators and identifiers
  Operator,
  DefaultOp,

  // Literals
  StringLiteral,
  NumberLiteral,
  Identifier,

  // Punctuation
  LParen,
  RParen,
  CloseBracket,
  Comma,

  // Whitespace (skipped in directive mode)
  WhiteSpace,

  // Plain text (catch-all, must be last)
  Text,
];

// =============================================================================
// LEXER INSTANCE
// =============================================================================

/**
 * Creates a new Echo lexer instance.
 *
 * TODO: Implement multi-mode lexer for proper context handling.
 * The current implementation is simplified and doesn't handle all edge cases.
 *
 * A proper implementation should use Chevrotain's multi-mode feature:
 * - DEFAULT_MODE: Look for [# or {{ to switch modes
 * - VARIABLE_MODE: Parse variable expressions until }}
 * - DIRECTIVE_MODE: Parse directive syntax until ]
 */
export const EchoLexer = new Lexer(allTokens, {
  // Ensure the lexer reports all errors
  ensureOptimizations: true,
});

/**
 * Tokenize an Echo template.
 *
 * @param template - The template string to tokenize
 * @returns Lexer result with tokens and errors
 */
export function tokenize(template: string) {
  return EchoLexer.tokenize(template);
}

// =============================================================================
// IMPLEMENTATION NOTES
// =============================================================================

/*
NEXT STEPS TO IMPLEMENT:

1. MULTI-MODE LEXER
   The current single-mode lexer is insufficient. Implement a multi-mode lexer:

   const multiModeLexerDefinition = {
     modes: {
       default_mode: [
         // Look for start of directives/variables
         { ...IfOpen, PUSH_MODE: 'directive_mode' },
         { ...VariableOpen, PUSH_MODE: 'variable_mode' },
         Text // Everything else
       ],
       variable_mode: [
         { ...VariableClose, POP_MODE: true },
         Identifier,
         DefaultOp,
         StringLiteral,
         // etc.
       ],
       directive_mode: [
         { ...CloseBracket, POP_MODE: true },
         VariableOpen, // Can have nested variables in conditions
         Operator,
         // etc.
       ]
     },
     defaultMode: 'default_mode'
   };

2. HANDLE TEXT PROPERLY
   The Text token pattern needs to be more sophisticated:
   - Match text that doesn't start [# or {{
   - Handle escaped sequences if needed

3. ERROR MESSAGES
   Add meaningful error messages for:
   - Unclosed {{ or }}
   - Unclosed [# or ]
   - Invalid operator names
   - Unterminated strings

4. TESTS
   Create lexer.test.ts with tests for:
   - Simple variable: "{{name}}"
   - Conditional: "[#IF {{x}} #equals(y)]...[END IF]"
   - Nested: "[#IF {{a}}]{{b}}[END IF]"
   - Edge cases: Empty template, only text, etc.
*/
