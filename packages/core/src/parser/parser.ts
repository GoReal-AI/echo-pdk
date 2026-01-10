/**
 * @fileoverview Echo DSL Parser - AST Generation
 *
 * This file implements the parser for Echo DSL using Chevrotain.
 * The parser converts a token stream into an Abstract Syntax Tree (AST).
 *
 * GRAMMAR (pseudo-BNF):
 *
 *   template     := (node)*
 *   node         := text | variable | conditional | section | import | include
 *   text         := TEXT
 *   variable     := "{{" identifier ("??" defaultValue)? "}}"
 *   conditional  := ifBlock (elseIfBlock)* (elseBlock)? endIf
 *   ifBlock      := "[#IF" condition "]" (node)*
 *   elseIfBlock  := "[ELSE IF" condition "]" (node)*
 *   elseBlock    := "[ELSE]" (node)*
 *   endIf        := "[END IF]"
 *   condition    := "{{" identifier "}}" operator
 *   operator     := "#" IDENTIFIER ("(" arguments ")")?
 *   arguments    := value ("," value)*
 *   value        := STRING | NUMBER | IDENTIFIER
 *   section      := "[#SECTION" "name" "=" STRING "]" (node)* "[END SECTION]"
 *   import       := "[#IMPORT" (STRING | path) "]"
 *   include      := "[#INCLUDE" IDENTIFIER "]"
 */

import { CstParser, type CstNode, type IToken } from 'chevrotain';
import type {
  ASTNode,
  ParseResult,
  SourceLocation,
  EchoError,
  ConditionExpr,
  ConditionalNode,
} from '../types.js';
import {
  allTokens,
  tokenize,
  formatLexerErrors,
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
  Equals,
  OperatorArgText,
} from './lexer.js';
import {
  createTextNode,
  createVariableNode,
  createConditionalNode,
  createConditionExpr,
  createSectionNode,
  createImportNode,
  createIncludeNode,
} from './ast.js';

// =============================================================================
// PARSER CLASS
// =============================================================================

/**
 * Echo CST Parser
 *
 * Parses Echo template tokens into a Concrete Syntax Tree (CST).
 * The CST is then transformed into our AST format using the visitor.
 */
class EchoParser extends CstParser {
  constructor() {
    super(allTokens, {
      recoveryEnabled: true,
      nodeLocationTracking: 'full',
    });

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
      this.SUBRULE(this.elseIfBlock);
    });

    // Optional ELSE block
    this.OPTION(() => {
      this.SUBRULE(this.elseBlock);
    });

    // [END IF]
    this.CONSUME(EndIf);
  });

  /**
   * ELSE IF block
   */
  private elseIfBlock = this.RULE('elseIfBlock', () => {
    this.CONSUME(ElseIf);
    this.SUBRULE(this.condition);
    this.CONSUME(CloseBracket);
    this.MANY(() => {
      this.SUBRULE(this.node);
    });
  });

  /**
   * ELSE block
   */
  private elseBlock = this.RULE('elseBlock', () => {
    this.CONSUME(Else);
    this.MANY(() => {
      this.SUBRULE(this.node);
    });
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

    // Optional arguments - free-form text
    this.OPTION(() => {
      this.CONSUME(LParen);
      this.OPTION2(() => {
        this.CONSUME(OperatorArgText);
      });
      this.CONSUME(RParen);
    });
  });

  /**
   * Section definition: [#SECTION name="..."]...[END SECTION]
   */
  private sectionNode = this.RULE('sectionNode', () => {
    this.CONSUME(SectionOpen);
    this.CONSUME(Identifier); // "name"
    this.CONSUME(Equals);
    this.CONSUME(StringLiteral); // "value"
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
// PARSER INSTANCE
// =============================================================================

const parserInstance = new EchoParser();

// =============================================================================
// CST TO AST VISITOR
// =============================================================================

/**
 * Get the base CST visitor class from our parser instance.
 */
const BaseCstVisitor = parserInstance.getBaseCstVisitorConstructor();

/**
 * Default source location for fallback.
 */
const defaultLocation: SourceLocation = {
  startLine: 1,
  startColumn: 1,
  endLine: 1,
  endColumn: 1,
};

/**
 * CST Visitor that transforms the Concrete Syntax Tree into our AST.
 */
class EchoAstVisitor extends BaseCstVisitor {
  constructor() {
    super();
    this.validateVisitor();
  }

  /**
   * Visit the root template rule.
   */
  template(ctx: CstTemplateContext): ASTNode[] {
    const nodes: ASTNode[] = [];

    if (ctx.node) {
      for (const nodeCtx of ctx.node) {
        const node = this.visit(nodeCtx);
        if (node) {
          nodes.push(node);
        }
      }
    }

    return nodes;
  }

  /**
   * Visit a node (dispatches to specific node type).
   */
  node(ctx: CstNodeContext): ASTNode | undefined {
    if (ctx.textNode?.[0]) {
      return this.visit(ctx.textNode[0]);
    }
    if (ctx.variableNode?.[0]) {
      return this.visit(ctx.variableNode[0]);
    }
    if (ctx.conditionalNode?.[0]) {
      return this.visit(ctx.conditionalNode[0]);
    }
    if (ctx.sectionNode?.[0]) {
      return this.visit(ctx.sectionNode[0]);
    }
    if (ctx.importNode?.[0]) {
      return this.visit(ctx.importNode[0]);
    }
    if (ctx.includeNode?.[0]) {
      return this.visit(ctx.includeNode[0]);
    }
    return undefined;
  }

  /**
   * Visit a text node.
   */
  textNode(ctx: CstTextNodeContext): ASTNode {
    const token = ctx.Text?.[0];
    if (!token) {
      return createTextNode('', defaultLocation);
    }
    return createTextNode(token.image, getTokenLocation(token));
  }

  /**
   * Visit a variable node.
   */
  variableNode(ctx: CstVariableNodeContext): ASTNode {
    const openToken = ctx.VariableOpen?.[0];
    const closeToken = ctx.VariableClose?.[0];
    const identifierToken = ctx.Identifier?.[0];

    if (!identifierToken) {
      return createVariableNode('', defaultLocation);
    }

    const path = identifierToken.image;

    let defaultValue: string | undefined;
    if (ctx.DefaultOp && (ctx.StringLiteral || ctx.NumberLiteral)) {
      const valueToken = ctx.StringLiteral?.[0] ?? ctx.NumberLiteral?.[0];
      if (valueToken) {
        defaultValue = stripQuotes(valueToken.image);
      }
    }

    const location = openToken && closeToken
      ? mergeLocations(getTokenLocation(openToken), getTokenLocation(closeToken))
      : getTokenLocation(identifierToken);

    return createVariableNode(path, location, defaultValue);
  }

  /**
   * Visit a conditional node.
   */
  conditionalNode(ctx: CstConditionalNodeContext): ASTNode {
    const ifOpenToken = ctx.IfOpen?.[0];
    const endIfToken = ctx.EndIf?.[0];

    // Parse the main condition
    const conditionCtx = ctx.condition?.[0];
    const condition = conditionCtx
      ? (this.visit(conditionCtx) as ConditionExpr)
      : createConditionExpr('', 'exists');

    // Parse body nodes
    const consequent: ASTNode[] = [];
    if (ctx.node) {
      for (const nodeCtx of ctx.node) {
        const node = this.visit(nodeCtx);
        if (node) {
          consequent.push(node);
        }
      }
    }

    // Build the alternate chain (ELSE IF and ELSE blocks)
    let alternate: ConditionalNode | ASTNode[] | undefined;

    // Handle ELSE block (process first as it's the end of the chain)
    if (ctx.elseBlock?.[0]) {
      const elseNodes = this.visit(ctx.elseBlock[0]) as ASTNode[];
      alternate = elseNodes;
    }

    // Handle ELSE IF blocks (in reverse order to build the chain)
    if (ctx.elseIfBlock) {
      for (let i = ctx.elseIfBlock.length - 1; i >= 0; i--) {
        const elseIfCtx = ctx.elseIfBlock[i];
        if (elseIfCtx) {
          const elseIfResult = this.visitElseIfBlockWithAlternate(elseIfCtx, alternate);
          alternate = elseIfResult;
        }
      }
    }

    const location = ifOpenToken && endIfToken
      ? mergeLocations(getTokenLocation(ifOpenToken), getTokenLocation(endIfToken))
      : defaultLocation;

    return createConditionalNode(condition, consequent, location, alternate);
  }

  /**
   * Visit an ELSE IF block and create a ConditionalNode with alternate.
   *
   * This method handles the CstNode structure from Chevrotain, using runtime
   * validation to safely access the children property.
   */
  private visitElseIfBlockWithAlternate(
    ctx: CstNode,
    nextAlternate?: ConditionalNode | ASTNode[]
  ): ConditionalNode {
    // Safely extract children with runtime validation
    const children = getCstChildren<CstElseIfBlockContext>(ctx, 'elseIfBlock');

    const elseIfToken = children.ElseIf?.[0];
    const closeBracketToken = children.CloseBracket?.[0];

    const conditionCtx = children.condition?.[0];
    const condition = conditionCtx
      ? (this.visit(conditionCtx) as ConditionExpr)
      : createConditionExpr('', 'exists');

    const consequent: ASTNode[] = [];
    if (children.node) {
      for (const nodeCtx of children.node) {
        const node = this.visit(nodeCtx);
        if (node) {
          consequent.push(node);
        }
      }
    }

    const location = elseIfToken && closeBracketToken
      ? mergeLocations(getTokenLocation(elseIfToken), getTokenLocation(closeBracketToken))
      : defaultLocation;

    return createConditionalNode(condition, consequent, location, nextAlternate);
  }

  /**
   * Visit an ELSE IF block.
   *
   * NOTE: This method exists to satisfy Chevrotain's visitor validation but should
   * never be called directly. ELSE IF blocks are only meaningful within the context
   * of a conditional chain, where they need the `nextAlternate` parameter.
   *
   * Use `visitElseIfBlockWithAlternate` instead, which is called from `conditionalNode`
   * to properly build the ELSE IF chain with alternates.
   *
   * @throws Error always - this method should not be called directly
   */
  elseIfBlock(_ctx: CstElseIfBlockContext): ConditionalNode {
    throw new Error(
      'elseIfBlock visitor should not be called directly. ' +
      'ELSE IF blocks are processed via visitElseIfBlockWithAlternate from conditionalNode.'
    );
  }

  /**
   * Visit an ELSE block.
   */
  elseBlock(ctx: CstElseBlockContext): ASTNode[] {
    const nodes: ASTNode[] = [];

    if (ctx.node) {
      for (const nodeCtx of ctx.node) {
        const node = this.visit(nodeCtx);
        if (node) {
          nodes.push(node);
        }
      }
    }

    return nodes;
  }

  /**
   * Visit a condition expression.
   */
  condition(ctx: CstConditionContext): ConditionExpr {
    const identifierToken = ctx.Identifier?.[0];
    const operatorToken = ctx.Operator?.[0];

    const variable = identifierToken?.image ?? '';
    const operator = (operatorToken?.image ?? '#exists').replace(/^#/, '');

    let argument: string | number | string[] | undefined;

    // Get the free-form argument text
    const argTextToken = ctx.OperatorArgText?.[0];
    if (argTextToken) {
      let argText = argTextToken.image.trim();

      // Strip surrounding quotes if present (backwards compatibility)
      argText = stripQuotes(argText);

      // Check if it looks like a number
      const num = parseFloat(argText);
      if (!isNaN(num) && String(num) === argText) {
        argument = num;
      }
      // Check if it contains commas (for list operators like #one_of)
      else if (argText.includes(',')) {
        argument = argText.split(',').map(s => stripQuotes(s.trim()));
      }
      // Otherwise treat as plain text
      else {
        argument = argText;
      }
    }

    return createConditionExpr(variable, operator, argument);
  }

  /**
   * Visit a section node.
   */
  sectionNode(ctx: CstSectionNodeContext): ASTNode {
    const sectionOpenToken = ctx.SectionOpen?.[0];
    const endSectionToken = ctx.EndSection?.[0];
    const nameToken = ctx.StringLiteral?.[0];

    const name = nameToken ? stripQuotes(nameToken.image) : '';

    const body: ASTNode[] = [];
    if (ctx.node) {
      for (const nodeCtx of ctx.node) {
        const node = this.visit(nodeCtx);
        if (node) {
          body.push(node);
        }
      }
    }

    const location = sectionOpenToken && endSectionToken
      ? mergeLocations(getTokenLocation(sectionOpenToken), getTokenLocation(endSectionToken))
      : defaultLocation;

    return createSectionNode(name, body, location);
  }

  /**
   * Visit an import node.
   */
  importNode(ctx: CstImportNodeContext): ASTNode {
    const importToken = ctx.Import?.[0];
    const closeBracketToken = ctx.CloseBracket?.[0];

    let path: string;
    if (ctx.StringLiteral?.[0]) {
      path = stripQuotes(ctx.StringLiteral[0].image);
    } else if (ctx.Identifier?.[0]) {
      path = ctx.Identifier[0].image;
    } else {
      path = '';
    }

    const location = importToken && closeBracketToken
      ? mergeLocations(getTokenLocation(importToken), getTokenLocation(closeBracketToken))
      : defaultLocation;

    return createImportNode(path, location);
  }

  /**
   * Visit an include node.
   */
  includeNode(ctx: CstIncludeNodeContext): ASTNode {
    const includeToken = ctx.Include?.[0];
    const closeBracketToken = ctx.CloseBracket?.[0];
    const identifierToken = ctx.Identifier?.[0];

    const name = identifierToken?.image ?? '';

    const location = includeToken && closeBracketToken
      ? mergeLocations(getTokenLocation(includeToken), getTokenLocation(closeBracketToken))
      : defaultLocation;

    return createIncludeNode(name, location);
  }
}

// Create singleton visitor instance
const astVisitor = new EchoAstVisitor();

// =============================================================================
// CST CONTEXT TYPES
// =============================================================================

interface CstTemplateContext {
  node?: CstNode[];
}

interface CstNodeContext {
  textNode?: CstNode[];
  variableNode?: CstNode[];
  conditionalNode?: CstNode[];
  sectionNode?: CstNode[];
  importNode?: CstNode[];
  includeNode?: CstNode[];
}

interface CstTextNodeContext {
  Text?: IToken[];
}

interface CstVariableNodeContext {
  VariableOpen?: IToken[];
  VariableClose?: IToken[];
  Identifier?: IToken[];
  DefaultOp?: IToken[];
  StringLiteral?: IToken[];
  NumberLiteral?: IToken[];
}

interface CstConditionalNodeContext {
  IfOpen?: IToken[];
  EndIf?: IToken[];
  CloseBracket?: IToken[];
  condition?: CstNode[];
  node?: CstNode[];
  elseIfBlock?: CstNode[];
  elseBlock?: CstNode[];
}

interface CstElseIfBlockContext {
  ElseIf?: IToken[];
  CloseBracket?: IToken[];
  condition?: CstNode[];
  node?: CstNode[];
}

interface CstElseBlockContext {
  Else?: IToken[];
  node?: CstNode[];
}

interface CstConditionContext {
  VariableOpen?: IToken[];
  VariableClose?: IToken[];
  Identifier?: IToken[];
  Operator?: IToken[];
  LParen?: IToken[];
  RParen?: IToken[];
  OperatorArgText?: IToken[];
}

interface CstSectionNodeContext {
  SectionOpen?: IToken[];
  EndSection?: IToken[];
  CloseBracket?: IToken[];
  Identifier?: IToken[];
  Equals?: IToken[];
  StringLiteral?: IToken[];
  node?: CstNode[];
}

interface CstImportNodeContext {
  Import?: IToken[];
  CloseBracket?: IToken[];
  StringLiteral?: IToken[];
  Identifier?: IToken[];
}

interface CstIncludeNodeContext {
  Include?: IToken[];
  CloseBracket?: IToken[];
  Identifier?: IToken[];
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Safely extract children from a CstNode with runtime validation.
 *
 * Chevrotain's CstNode has a `children` property containing the parsed elements.
 * This helper provides type-safe access with runtime validation to guard against
 * unexpected structure changes.
 *
 * @param ctx - The CstNode to extract children from
 * @param expectedRule - Optional rule name to validate (for better error messages)
 * @returns The children object, typed as T
 * @throws Error if children property is missing or invalid
 */
function getCstChildren<T>(ctx: CstNode, expectedRule?: string): T {
  if (!ctx || typeof ctx !== 'object') {
    throw new Error(
      `Invalid CST node${expectedRule ? ` for rule "${expectedRule}"` : ''}: expected object, got ${typeof ctx}`
    );
  }

  if (!('children' in ctx)) {
    throw new Error(
      `Invalid CST node${expectedRule ? ` for rule "${expectedRule}"` : ''}: missing "children" property`
    );
  }

  const children = ctx.children;
  if (!children || typeof children !== 'object') {
    throw new Error(
      `Invalid CST node${expectedRule ? ` for rule "${expectedRule}"` : ''}: "children" must be an object`
    );
  }

  return children as T;
}

/**
 * Extract source location from a token.
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

/**
 * Merge two source locations into one spanning both.
 */
function mergeLocations(start: SourceLocation, end: SourceLocation): SourceLocation {
  return {
    startLine: start.startLine,
    startColumn: start.startColumn,
    endLine: end.endLine,
    endColumn: end.endColumn,
  };
}

/**
 * Strip quotes from a string literal token.
 */
function stripQuotes(str: string): string {
  if ((str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
}

/**
 * Format parser errors for display.
 */
function formatParserErrors(errors: typeof parserInstance.errors): EchoError[] {
  return errors.map((error) => {
    const token = error.token;
    return {
      code: 'PARSE_ERROR',
      message: error.message,
      location: token ? getTokenLocation(token) : undefined,
    };
  });
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Parse an Echo template into an AST.
 *
 * @param template - The Echo template string
 * @returns ParseResult with AST or errors
 *
 * @example
 * ```typescript
 * const result = parse('Hello {{name}}!');
 * if (result.success) {
 *   console.log('AST:', result.ast);
 * } else {
 *   console.error('Errors:', result.errors);
 * }
 * ```
 */
export function parse(template: string): ParseResult {
  // Step 1: Tokenize the input
  const lexResult = tokenize(template);

  if (lexResult.errors.length > 0) {
    return {
      success: false,
      errors: formatLexerErrors(lexResult.errors).map((msg) => ({
        code: 'LEXER_ERROR',
        message: msg,
      })),
    };
  }

  // Step 2: Parse tokens to CST
  parserInstance.input = lexResult.tokens;
  const cst = parserInstance.template();

  if (parserInstance.errors.length > 0) {
    return {
      success: false,
      errors: formatParserErrors(parserInstance.errors),
    };
  }

  // Step 3: Transform CST to AST
  try {
    const ast = astVisitor.visit(cst) as ASTNode[];

    return {
      success: true,
      ast,
      errors: [],
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          code: 'AST_ERROR',
          message: error instanceof Error ? error.message : 'Unknown AST transformation error',
        },
      ],
    };
  }
}
