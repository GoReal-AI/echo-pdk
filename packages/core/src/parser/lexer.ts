/**
 * @fileoverview Echo DSL Lexer - Multi-Mode Tokenization
 *
 * This file implements the lexer (tokenizer) for Echo DSL using Chevrotain.
 * Uses multi-mode lexing to handle context-sensitive token recognition.
 *
 * LEXER MODES:
 * - DEFAULT_MODE: Normal text content, looking for directives and variables
 * - DIRECTIVE_MODE: Inside [#IF ...], [#SECTION ...], etc.
 * - VARIABLE_MODE: Inside {{ ... }}
 *
 * TOKEN STREAM EXAMPLE:
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

import {
  createToken,
  Lexer,
  type TokenType,
  type IMultiModeLexerDefinition,
} from 'chevrotain';

// =============================================================================
// TOKEN DEFINITIONS
// =============================================================================

// -----------------------------------------------------------------------------
// Token Categories
// These are abstract tokens that serve as parent categories.
// Mode-specific variants extend these categories so the parser can match either.
// -----------------------------------------------------------------------------

/**
 * Category for variable open tokens ({{)
 */
export const VariableOpen = createToken({
  name: 'VariableOpen',
  pattern: Lexer.NA, // Abstract - no pattern
});

/**
 * Category for variable close tokens (}})
 */
export const VariableClose = createToken({
  name: 'VariableClose',
  pattern: Lexer.NA, // Abstract - no pattern
});

// -----------------------------------------------------------------------------
// Directive Keywords (Complete - no mode switch needed)
// -----------------------------------------------------------------------------

/**
 * [END IF] - End of conditional block
 */
export const EndIf = createToken({
  name: 'EndIf',
  pattern: /\[END IF\]/,
});

/**
 * [END SECTION] - End of section definition
 */
export const EndSection = createToken({
  name: 'EndSection',
  pattern: /\[END SECTION\]/,
});

/**
 * [ELSE] - Else branch (complete token)
 */
export const Else = createToken({
  name: 'Else',
  pattern: /\[ELSE\]/,
});

// -----------------------------------------------------------------------------
// Directive Openers (Push to DIRECTIVE_MODE)
// -----------------------------------------------------------------------------

/**
 * [#IF - Start of conditional (followed by condition)
 */
export const IfOpen = createToken({
  name: 'IfOpen',
  pattern: /\[#IF/,
  push_mode: 'DIRECTIVE_MODE',
});

/**
 * [ELSE IF - Else-if branch (followed by condition)
 */
export const ElseIf = createToken({
  name: 'ElseIf',
  pattern: /\[ELSE IF/,
  push_mode: 'DIRECTIVE_MODE',
});

/**
 * [#SECTION - Section definition (followed by name="value")
 */
export const SectionOpen = createToken({
  name: 'SectionOpen',
  pattern: /\[#SECTION/,
  push_mode: 'DIRECTIVE_MODE',
});

/**
 * [#IMPORT - Import directive (followed by path)
 */
export const Import = createToken({
  name: 'Import',
  pattern: /\[#IMPORT/,
  push_mode: 'DIRECTIVE_MODE',
});

/**
 * [#INCLUDE - Include directive (followed by section name)
 */
export const Include = createToken({
  name: 'Include',
  pattern: /\[#INCLUDE/,
  push_mode: 'DIRECTIVE_MODE',
});

// -----------------------------------------------------------------------------
// Variable Syntax - Mode-Specific Variants
// -----------------------------------------------------------------------------

/**
 * {{ in DEFAULT_MODE - pushes to VARIABLE_MODE
 * Extends VariableOpen category so parser can match it.
 */
const VariableOpenDefault = createToken({
  name: 'VariableOpenDefault',
  pattern: /\{\{/,
  push_mode: 'VARIABLE_MODE',
  categories: [VariableOpen],
});

/**
 * {{ in DIRECTIVE_MODE - no mode change (conditions are inline)
 * Extends VariableOpen category so parser can match it.
 */
const VariableOpenDirective = createToken({
  name: 'VariableOpenDirective',
  pattern: /\{\{/,
  categories: [VariableOpen],
});

/**
 * }} in VARIABLE_MODE - pops back to previous mode
 * Extends VariableClose category so parser can match it.
 */
const VariableCloseVariable = createToken({
  name: 'VariableCloseVariable',
  pattern: /\}\}/,
  pop_mode: true,
  categories: [VariableClose],
});

/**
 * }} in DIRECTIVE_MODE - no mode change
 * Extends VariableClose category so parser can match it.
 */
const VariableCloseDirective = createToken({
  name: 'VariableCloseDirective',
  pattern: /\}\}/,
  categories: [VariableClose],
});

// -----------------------------------------------------------------------------
// Directive Mode Tokens
// -----------------------------------------------------------------------------

/**
 * ] - End of directive (pops back to DEFAULT_MODE)
 */
export const CloseBracket = createToken({
  name: 'CloseBracket',
  pattern: /\]/,
  pop_mode: true,
});

/**
 * Operator - #equals, #contains, #ai_judge, etc.
 */
export const Operator = createToken({
  name: 'Operator',
  pattern: /#[a-zA-Z_][a-zA-Z0-9_]*/,
});

/**
 * Identifier - variable names, section names, etc.
 * Supports nested paths: user.name, items[0]
 */
export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*|\[\d+\])*/,
});

/**
 * String literal - "value" or 'value'
 */
export const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"[^"]*"|'[^']*'/,
});

/**
 * Number literal - integers and decimals
 */
export const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /-?\d+(?:\.\d+)?/,
});

/**
 * ( - Left parenthesis for operator arguments
 * Pushes to OPERATOR_ARG_MODE to capture free-form text
 */
export const LParen = createToken({
  name: 'LParen',
  pattern: /\(/,
  push_mode: 'OPERATOR_ARG_MODE',
});

/**
 * ) - Right parenthesis for operator arguments (in DIRECTIVE_MODE)
 */
export const RParen = createToken({
  name: 'RParen',
  pattern: /\)/,
});

/**
 * ) - Right parenthesis that pops from OPERATOR_ARG_MODE
 */
const RParenOperatorArg = createToken({
  name: 'RParenOperatorArg',
  pattern: /\)/,
  pop_mode: true,
  categories: [RParen], // Extends RParen so parser sees it the same
});

/**
 * Operator argument text - captures everything until closing paren.
 * This allows natural text like "My Girlfriend" without quotes.
 */
export const OperatorArgText = createToken({
  name: 'OperatorArgText',
  pattern: /[^)]+/,
});

/**
 * , - Comma separator in argument lists
 */
export const Comma = createToken({
  name: 'Comma',
  pattern: /,/,
});

/**
 * = - Equals sign for attribute assignment (name="value")
 */
export const Equals = createToken({
  name: 'Equals',
  pattern: /=/,
});

/**
 * ?? - Default value operator
 */
export const DefaultOp = createToken({
  name: 'DefaultOp',
  pattern: /\?\?/,
});

/**
 * Whitespace - skipped in directive and variable modes
 */
export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

// -----------------------------------------------------------------------------
// Text Content
// -----------------------------------------------------------------------------

/**
 * Text - Plain text content.
 *
 * Matches any character sequence that doesn't start a special Echo construct.
 * The lexer must stop when encountering:
 * - `{{` (variable start)
 * - `[#` (directive start: [#IF, [#SECTION, [#IMPORT, [#INCLUDE)
 * - `[E` (branch/end markers: [ELSE], [ELSE IF, [END IF], [END SECTION])
 *
 * REGEX BREAKDOWN: /(?:[^\[{]|\[(?![#E])|\{(?!\{))+/
 *
 *   (?:                    Non-capturing group containing three alternatives:
 *   │
 *   ├─ [^\[{]              Alt 1: Any character EXCEPT '[' or '{'
 *   │                            These are safe - no special meaning
 *   │
 *   ├─ \[(?![#E])          Alt 2: A '[' NOT followed by '#' or 'E'
 *   │   │                        Allows: [x, [1, [anything-else
 *   │   └─ (?![#E])              Negative lookahead excludes:
 *   │                              - [# (directives like [#IF)
 *   │                              - [E (branches like [ELSE], [END IF])
 *   │
 *   └─ \{(?!\{)            Alt 3: A '{' NOT followed by another '{'
 *       │                        Allows: single { in text
 *       └─ (?!\{)                Negative lookahead excludes:
 *                                  - {{ (variable start)
 *   )+                     One or more matches (greedy)
 *
 * EXAMPLES:
 *   "Hello world"     → matches entirely (no special chars)
 *   "Hello {{name}}"  → matches "Hello " then stops at {{
 *   "Price: $[100]"   → matches entirely ([1 is not [# or [E)
 *   "Use {braces}"    → matches entirely (single { is allowed)
 *   "[#IF ..."        → matches nothing (starts with [#)
 */
export const Text = createToken({
  name: 'Text',
  pattern: /(?:[^\[{]|\[(?![#E])|\{(?!\{))+/,
  line_breaks: true,
});

// =============================================================================
// TOKEN GROUPS
// =============================================================================

/**
 * All tokens used in DEFAULT_MODE.
 * Order matters - more specific patterns first.
 */
const defaultModeTokens: TokenType[] = [
  // Complete directive tokens (no mode change)
  EndIf,
  EndSection,
  Else,

  // Directive openers (push to DIRECTIVE_MODE)
  IfOpen,
  ElseIf,
  SectionOpen,
  Import,
  Include,

  // Variable (push to VARIABLE_MODE)
  VariableOpenDefault,

  // Plain text (catch-all - must be last)
  Text,
];

/**
 * Tokens used inside directives [#IF ...], [#SECTION ...], etc.
 */
const directiveModeTokens: TokenType[] = [
  // End directive (pop mode)
  CloseBracket,

  // Nested variable in conditions
  VariableOpenDirective,
  VariableCloseDirective,

  // Operators and punctuation
  Operator,
  DefaultOp,
  Equals,
  LParen,
  RParen,
  Comma,

  // Literals (before Identifier to catch numbers first)
  StringLiteral,
  NumberLiteral,
  Identifier,

  // Whitespace (skipped)
  WhiteSpace,
];

/**
 * Tokens used inside variables {{ ... }}
 */
const variableModeTokens: TokenType[] = [
  // End variable (pop mode)
  VariableCloseVariable,

  // Default operator
  DefaultOp,

  // Literals
  StringLiteral,
  NumberLiteral,
  Identifier,

  // Whitespace (skipped)
  WhiteSpace,
];

/**
 * Tokens used inside operator arguments ( ... )
 * Captures free-form text until closing paren.
 */
const operatorArgModeTokens: TokenType[] = [
  // End of argument (pop mode)
  RParenOperatorArg,

  // Free-form text content
  OperatorArgText,
];

// =============================================================================
// MULTI-MODE LEXER DEFINITION
// =============================================================================

/**
 * Multi-mode lexer configuration.
 * Enables context-sensitive tokenization.
 */
const multiModeLexerDefinition: IMultiModeLexerDefinition = {
  modes: {
    DEFAULT_MODE: defaultModeTokens,
    DIRECTIVE_MODE: directiveModeTokens,
    VARIABLE_MODE: variableModeTokens,
    OPERATOR_ARG_MODE: operatorArgModeTokens,
  },
  defaultMode: 'DEFAULT_MODE',
};

/**
 * All unique tokens (for parser configuration).
 * Includes category tokens and all mode-specific variants.
 *
 * IMPORTANT: Category tokens must come BEFORE their child tokens
 * in this array for Chevrotain to properly recognize them.
 */
export const allTokens: TokenType[] = [
  // Categories first (abstract tokens)
  VariableOpen,
  VariableClose,

  // Directive keywords
  EndIf,
  EndSection,
  Else,
  IfOpen,
  ElseIf,
  SectionOpen,
  Import,
  Include,

  // Mode-specific variable tokens (extend categories)
  VariableOpenDefault,
  VariableOpenDirective,
  VariableCloseVariable,
  VariableCloseDirective,

  // Operators and punctuation
  Operator,
  DefaultOp,
  Equals,
  CloseBracket,
  LParen,
  RParen,
  RParenOperatorArg,
  Comma,

  // Operator argument mode tokens
  OperatorArgText,

  // Literals
  StringLiteral,
  NumberLiteral,
  Identifier,

  // Whitespace
  WhiteSpace,

  // Text
  Text,
];

// =============================================================================
// LEXER INSTANCE
// =============================================================================

/**
 * The Echo multi-mode lexer instance.
 * Uses different token sets depending on the current lexing context.
 */
export const EchoLexer = new Lexer(multiModeLexerDefinition, {
  // Note: We disable ensureOptimizations because the Text token uses
  // a complement set pattern which cannot be optimized by Chevrotain.
  // The lexer still works correctly, just without first-char optimizations.
  ensureOptimizations: false,
  positionTracking: 'full', // Required for source locations
});

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Tokenize an Echo template.
 *
 * @param template - The template string to tokenize
 * @returns Lexer result with tokens and errors
 *
 * @example
 * ```typescript
 * const result = tokenize('Hello {{name}}!');
 * if (result.errors.length > 0) {
 *   console.error('Lexer errors:', result.errors);
 * } else {
 *   console.log('Tokens:', result.tokens);
 * }
 * ```
 */
export function tokenize(template: string) {
  return EchoLexer.tokenize(template);
}

/**
 * Format lexer errors for display.
 *
 * @param errors - Lexer errors from tokenize()
 * @returns Formatted error messages
 */
export function formatLexerErrors(
  errors: ReturnType<typeof tokenize>['errors']
): string[] {
  return errors.map((error) => {
    const line = error.line ?? 1;
    const column = error.column ?? 1;
    return `Lexer error at line ${line}, column ${column}: ${error.message}`;
  });
}
