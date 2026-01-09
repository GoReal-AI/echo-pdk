/**
 * @fileoverview Parser module exports
 */

export { tokenize, EchoLexer } from './lexer.js';
export { parse, getTokenLocation } from './parser.js';
export {
  // Node factories
  createTextNode,
  createVariableNode,
  createConditionalNode,
  createConditionExpr,
  createSectionNode,
  createImportNode,
  createIncludeNode,
  // Visitor
  visitNode,
  visitNodes,
  // Utilities
  collectAiJudgeConditions,
  cloneNode,
  prettyPrint,
} from './ast.js';

export type { ASTVisitor } from './ast.js';
