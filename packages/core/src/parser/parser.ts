/**
 * @fileoverview Echo DSL Parser - AST Generation
 *
 * This file implements the parser for Echo DSL using Chevrotain.
 * The parser converts a token stream into an Abstract Syntax Tree (AST).
 *
 * IMPLEMENTATION GUIDE:
 *
 * 1. GRAMMAR RULES
 *    The Echo grammar (in pseudo-BNF):
 *
 *    template     := (node)*
 *    node         := text | variable | conditional | section | import | include
 *    text         := TEXT
 *    variable     := "{{" identifier ("??" defaultValue)? "}}"
 *    identifier   := IDENTIFIER ("." IDENTIFIER | "[" index "]")*
 *    conditional  := ifBlock (elseIfBlock)* (elseBlock)? endIf
 *    ifBlock      := "[#IF" condition "]" (node)*
 *    elseIfBlock  := "[ELSE IF" condition "]" (node)*
 *    elseBlock    := "[ELSE]" (node)*
 *    endIf        := "[END IF]"
 *    condition    := variable operator
 *    operator     := "#" IDENTIFIER ("(" arguments ")")?
 *    arguments    := value ("," value)*
 *    value        := STRING | NUMBER | IDENTIFIER
 *    section      := "[#SECTION" "name=" STRING "]" (node)* "[END SECTION]"
 *    import       := "[#IMPORT" path "]"
 *    include      := "[#INCLUDE" IDENTIFIER "]"
 *
 * 2. PARSER CLASS STRUCTURE
 *    Use Chevrotain's CstParser or EmbeddedActionsParser:
 *
 *    class EchoParser extends CstParser {
 *      constructor() {
 *        super(allTokens);
 *        this.performSelfAnalysis();
 *      }
 *
 *      template = this.RULE("template", () => {
 *        this.MANY(() => this.SUBRULE(this.node));
 *      });
 *
 *      node = this.RULE("node", () => {
 *        this.OR([
 *          { ALT: () => this.SUBRULE(this.textNode) },
 *          { ALT: () => this.SUBRULE(this.variableNode) },
 *          { ALT: () => this.SUBRULE(this.conditionalNode) },
 *          // ... etc
 *        ]);
 *      });
 *
 *      // ... more rules
 *    }
 *
 * 3. CST TO AST TRANSFORMATION
 *    After parsing to CST, transform to our AST types.
 *    Use a visitor pattern for clean transformation.
 *
 * 4. ERROR RECOVERY
 *    Implement error recovery for:
 *    - Unclosed blocks
 *    - Missing operators
 *    - Invalid nesting
 *
 * 5. SOURCE LOCATIONS
 *    Track source locations for all nodes for error reporting.
 */

import { CstParser, type IToken } from 'chevrotain';
import type { ParseResult, SourceLocation } from '../types.js';
import {
  allTokens,
  Text,
  VariableOpen,
  VariableClose,
  IfOpen,
  ElseIf,
  Else,
  EndIf,
  SectionOpen,
  EndSection,
  Import,
  Include,
  Operator,
  Identifier,
  StringLiteral,
  NumberLiteral,
  LParen,
  RParen,
  CloseBracket,
  DefaultOp,
  Comma,
} from './lexer.js';

// =============================================================================
// PARSER CLASS
// =============================================================================

/**
 * Echo CST Parser
 *
 * Parses Echo template tokens into a Concrete Syntax Tree (CST).
 * The CST is then transformed into our AST format.
 */
class EchoParser extends CstParser {
  constructor() {
    super(allTokens, {
      recoveryEnabled: true, // Enable error recovery
    });

    // Must be called after all rules are defined
    this.performSelfAnalysis();
  }

  // ---------------------------------------------------------------------------
  // GRAMMAR RULES
  // ---------------------------------------------------------------------------

  /**
   * Top-level rule: a template is a sequence of nodes
   */
  public template = this.RULE('template', () => {
    this.MANY(() => {
      this.SUBRULE(this.node);
    });
  });

  /**
   * A node can be text, variable, conditional, section, import, or include
   */
  private node = this.RULE('node', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.textNode) },
      { ALT: () => this.SUBRULE(this.variableNode) },
      { ALT: () => this.SUBRULE(this.conditionalNode) },
      { ALT: () => this.SUBRULE(this.sectionNode) },
      { ALT: () => this.SUBRULE(this.importNode) },
      { ALT: () => this.SUBRULE(this.includeNode) },
    ]);
  });

  /**
   * Plain text node
   */
  private textNode = this.RULE('textNode', () => {
    this.CONSUME(Text);
  });

  /**
   * Variable reference: {{path}} or {{path ?? "default"}}
   */
  private variableNode = this.RULE('variableNode', () => {
    this.CONSUME(VariableOpen);
    this.CONSUME(Identifier);
    this.OPTION(() => {
      this.CONSUME(DefaultOp);
      this.OR([
        { ALT: () => this.CONSUME(StringLiteral) },
        { ALT: () => this.CONSUME(NumberLiteral) },
      ]);
    });
    this.CONSUME(VariableClose);
  });

  /**
   * Conditional block: [#IF condition]...[ELSE IF]...[ELSE]...[END IF]
   */
  private conditionalNode = this.RULE('conditionalNode', () => {
    // [#IF condition]
    this.CONSUME(IfOpen);
    this.SUBRULE(this.condition);
    this.CONSUME(CloseBracket);

    // Body nodes
    this.MANY(() => {
      this.SUBRULE(this.node);
    });

    // Optional ELSE IF blocks
    this.MANY2(() => {
      this.CONSUME(ElseIf);
      this.SUBRULE2(this.condition);
      this.CONSUME2(CloseBracket);
      this.MANY3(() => {
        this.SUBRULE2(this.node);
      });
    });

    // Optional ELSE block
    this.OPTION(() => {
      this.CONSUME(Else);
      this.MANY4(() => {
        this.SUBRULE3(this.node);
      });
    });

    // [END IF]
    this.CONSUME(EndIf);
  });

  /**
   * Condition expression: {{var}} #operator(arg)
   */
  private condition = this.RULE('condition', () => {
    // Variable being tested
    this.CONSUME(VariableOpen);
    this.CONSUME(Identifier);
    this.CONSUME(VariableClose);

    // Operator
    this.CONSUME(Operator);

    // Optional arguments
    this.OPTION(() => {
      this.CONSUME(LParen);
      this.SUBRULE(this.argumentList);
      this.CONSUME(RParen);
    });
  });

  /**
   * Argument list for operators
   */
  private argumentList = this.RULE('argumentList', () => {
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(Identifier) },
    ]);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.OR2([
        { ALT: () => this.CONSUME2(StringLiteral) },
        { ALT: () => this.CONSUME2(NumberLiteral) },
        { ALT: () => this.CONSUME2(Identifier) },
      ]);
    });
  });

  /**
   * Section definition: [#SECTION name="..."]...[END SECTION]
   */
  private sectionNode = this.RULE('sectionNode', () => {
    this.CONSUME(SectionOpen);
    // TODO: Parse name="value" attribute
    this.CONSUME(Identifier); // name
    this.CONSUME(StringLiteral); // value
    this.CONSUME(CloseBracket);

    this.MANY(() => {
      this.SUBRULE(this.node);
    });

    this.CONSUME(EndSection);
  });

  /**
   * Import directive: [#IMPORT path]
   */
  private importNode = this.RULE('importNode', () => {
    this.CONSUME(Import);
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(Identifier) },
    ]);
    this.CONSUME(CloseBracket);
  });

  /**
   * Include directive: [#INCLUDE name]
   */
  private includeNode = this.RULE('includeNode', () => {
    this.CONSUME(Include);
    this.CONSUME(Identifier);
    this.CONSUME(CloseBracket);
  });
}

// =============================================================================
// PARSER INSTANCE & VISITOR
// =============================================================================

// Singleton parser instance
const parserInstance = new EchoParser();

// Get the CST visitor base class
const BaseCstVisitor = parserInstance.getBaseCstVisitorConstructor();

/**
 * CST to AST Visitor
 *
 * Transforms the Concrete Syntax Tree into our Abstract Syntax Tree.
 *
 * TODO: Implement visitor methods for each rule:
 * - template(ctx): ASTNode[]
 * - node(ctx): ASTNode
 * - textNode(ctx): TextNode
 * - variableNode(ctx): VariableNode
 * - conditionalNode(ctx): ConditionalNode
 * - condition(ctx): ConditionExpr
 * - sectionNode(ctx): SectionNode
 * - importNode(ctx): ImportNode
 * - includeNode(ctx): IncludeNode
 *
 * Example implementation:
 * class EchoAstVisitor extends BaseCstVisitor {
 *   constructor() {
 *     super();
 *     this.validateVisitor();
 *   }
 *   template(ctx) { return []; }
 * }
 * const astVisitor = new EchoAstVisitor();
 */
void BaseCstVisitor; // Reference to prevent unused warning

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Parse an Echo template into an AST.
 *
 * @param template - The Echo template string
 * @returns ParseResult with AST or errors
 */
export function parse(_template: string): ParseResult {
  // TODO: Implement parsing
  //
  // 1. Tokenize the input
  //    const lexResult = tokenize(template);
  //    if (lexResult.errors.length > 0) {
  //      return { success: false, errors: formatLexErrors(lexResult.errors) };
  //    }
  //
  // 2. Parse tokens to CST
  //    parserInstance.input = lexResult.tokens;
  //    const cst = parserInstance.template();
  //    if (parserInstance.errors.length > 0) {
  //      return { success: false, errors: formatParseErrors(parserInstance.errors) };
  //    }
  //
  // 3. Transform CST to AST
  //    const ast = astVisitor.visit(cst);
  //
  // 4. Return result
  //    return { success: true, ast, errors: [] };

  return {
    success: false,
    errors: [
      {
        code: 'NOT_IMPLEMENTED',
        message: 'Parser not yet implemented',
      },
    ],
  };
}

/**
 * Helper to extract source location from a token.
 */
export function getTokenLocation(token: IToken): SourceLocation {
  return {
    startLine: token.startLine ?? 1,
    startColumn: token.startColumn ?? 1,
    endLine: token.endLine ?? 1,
    endColumn: token.endColumn ?? 1,
    source: token.image,
  };
}

// =============================================================================
// IMPLEMENTATION NOTES
// =============================================================================

/*
NEXT STEPS TO IMPLEMENT:

1. COMPLETE VISITOR METHODS
   Each visitor method should:
   - Extract relevant tokens from ctx
   - Build the corresponding AST node
   - Handle source locations properly

   Example:
   textNode(ctx) {
     const token = ctx.Text[0];
     return {
       type: 'text',
       value: token.image,
       location: getTokenLocation(token)
     };
   }

2. HANDLE NESTED STRUCTURES
   The conditionalNode visitor needs to:
   - Recursively visit body nodes
   - Handle ELSE IF chains properly
   - Build the alternate chain correctly

3. ERROR RECOVERY
   Chevrotain's recovery produces partial CST.
   Handle missing tokens gracefully.

4. VALIDATION
   After parsing, validate:
   - All referenced sections exist
   - Operators are known
   - Variable paths are syntactically valid

5. TESTS
   Create parser.test.ts with tests for:
   - Simple templates
   - Nested conditionals
   - ELSE IF chains
   - Imports and includes
   - Error cases
*/
