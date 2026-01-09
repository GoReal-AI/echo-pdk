/**
 * @fileoverview AST Utilities - Node creation and traversal
 *
 * This file provides utility functions for working with the Echo AST.
 * Includes factory functions for creating nodes and visitor pattern helpers.
 *
 * IMPLEMENTATION GUIDE:
 *
 * 1. NODE FACTORIES
 *    Factory functions ensure consistent node creation with proper defaults.
 *
 * 2. VISITOR PATTERN
 *    Implement a visitor for AST traversal. This is the primary way to:
 *    - Collect AI judge conditions
 *    - Evaluate nodes
 *    - Transform the AST
 *
 * 3. AST UTILITIES
 *    - Clone nodes (deep copy)
 *    - Find nodes by type
 *    - Pretty print for debugging
 */

import type {
  ASTNode,
  TextNode,
  VariableNode,
  ConditionalNode,
  SectionNode,
  ImportNode,
  IncludeNode,
  SourceLocation,
  ConditionExpr,
} from '../types.js';

// =============================================================================
// NODE FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a TextNode.
 */
export function createTextNode(
  value: string,
  location: SourceLocation
): TextNode {
  return {
    type: 'text',
    value,
    location,
  };
}

/**
 * Create a VariableNode.
 */
export function createVariableNode(
  path: string,
  location: SourceLocation,
  defaultValue?: string
): VariableNode {
  return {
    type: 'variable',
    path,
    defaultValue,
    location,
  };
}

/**
 * Create a ConditionalNode.
 */
export function createConditionalNode(
  condition: ConditionExpr,
  consequent: ASTNode[],
  location: SourceLocation,
  alternate?: ConditionalNode | ASTNode[]
): ConditionalNode {
  return {
    type: 'conditional',
    condition,
    consequent,
    alternate,
    location,
  };
}

/**
 * Create a ConditionExpr.
 */
export function createConditionExpr(
  variable: string,
  operator: string,
  argument?: string | number | string[]
): ConditionExpr {
  return {
    variable,
    operator,
    argument,
    isAiJudge: operator === 'ai_judge',
  };
}

/**
 * Create a SectionNode.
 */
export function createSectionNode(
  name: string,
  body: ASTNode[],
  location: SourceLocation
): SectionNode {
  return {
    type: 'section',
    name,
    body,
    location,
  };
}

/**
 * Create an ImportNode.
 */
export function createImportNode(
  path: string,
  location: SourceLocation
): ImportNode {
  return {
    type: 'import',
    path,
    location,
  };
}

/**
 * Create an IncludeNode.
 */
export function createIncludeNode(
  name: string,
  location: SourceLocation
): IncludeNode {
  return {
    type: 'include',
    name,
    location,
  };
}

// =============================================================================
// VISITOR PATTERN
// =============================================================================

/**
 * Visitor interface for AST traversal.
 * Implement this interface to walk the AST.
 */
export interface ASTVisitor<T = void> {
  visitText?(node: TextNode): T;
  visitVariable?(node: VariableNode): T;
  visitConditional?(node: ConditionalNode): T;
  visitSection?(node: SectionNode): T;
  visitImport?(node: ImportNode): T;
  visitInclude?(node: IncludeNode): T;
}

/**
 * Walk an AST node with a visitor.
 *
 * @param node - The AST node to visit
 * @param visitor - The visitor implementation
 * @returns The result from the visitor (if any)
 */
export function visitNode<T>(node: ASTNode, visitor: ASTVisitor<T>): T | undefined {
  switch (node.type) {
    case 'text':
      return visitor.visitText?.(node);
    case 'variable':
      return visitor.visitVariable?.(node);
    case 'conditional':
      return visitor.visitConditional?.(node);
    case 'section':
      return visitor.visitSection?.(node);
    case 'import':
      return visitor.visitImport?.(node);
    case 'include':
      return visitor.visitInclude?.(node);
    default: {
      // Exhaustiveness check
      const _exhaustive: never = node;
      throw new Error(`Unknown node type: ${(_exhaustive as ASTNode).type}`);
    }
  }
}

/**
 * Walk an array of AST nodes with a visitor.
 *
 * @param nodes - The AST nodes to visit
 * @param visitor - The visitor implementation
 * @returns Array of results from the visitor
 */
export function visitNodes<T>(
  nodes: ASTNode[],
  visitor: ASTVisitor<T>
): (T | undefined)[] {
  return nodes.map((node) => visitNode(node, visitor));
}

// =============================================================================
// AST UTILITIES
// =============================================================================

/**
 * Collect all AI judge conditions from an AST.
 * This is used for parallel optimization.
 *
 * @param ast - The AST to search
 * @returns Array of AI judge conditions with their locations
 */
export function collectAiJudgeConditions(
  ast: ASTNode[]
): { condition: ConditionExpr; location: SourceLocation }[] {
  const results: { condition: ConditionExpr; location: SourceLocation }[] = [];

  const visitor: ASTVisitor = {
    visitConditional(node: ConditionalNode) {
      // Check this node's condition
      if (node.condition.isAiJudge) {
        results.push({
          condition: node.condition,
          location: node.location,
        });
      }

      // Recurse into children
      visitNodes(node.consequent, visitor);

      if (node.alternate) {
        if (Array.isArray(node.alternate)) {
          visitNodes(node.alternate, visitor);
        } else {
          visitNode(node.alternate, visitor);
        }
      }
    },

    visitSection(node: SectionNode) {
      visitNodes(node.body, visitor);
    },
  };

  visitNodes(ast, visitor);
  return results;
}

/**
 * Deep clone an AST node.
 *
 * @param node - The node to clone
 * @returns A deep copy of the node
 */
export function cloneNode<T extends ASTNode>(node: T): T {
  return JSON.parse(JSON.stringify(node)) as T;
}

/**
 * Pretty print an AST for debugging.
 *
 * @param ast - The AST to print
 * @param indent - Current indentation level
 * @returns Formatted string representation
 */
export function prettyPrint(ast: ASTNode[], indent = 0): string {
  const pad = '  '.repeat(indent);
  const lines: string[] = [];

  for (const node of ast) {
    switch (node.type) {
      case 'text':
        lines.push(`${pad}TEXT: "${node.value.slice(0, 50)}..."`);
        break;
      case 'variable':
        lines.push(
          `${pad}VAR: {{${node.path}}}${node.defaultValue ? ` ?? "${node.defaultValue}"` : ''}`
        );
        break;
      case 'conditional':
        lines.push(
          `${pad}IF: {{${node.condition.variable}}} #${node.condition.operator}(${node.condition.argument ?? ''})`
        );
        lines.push(prettyPrint(node.consequent, indent + 1));
        if (node.alternate) {
          if (Array.isArray(node.alternate)) {
            lines.push(`${pad}ELSE:`);
            lines.push(prettyPrint(node.alternate, indent + 1));
          } else {
            lines.push(`${pad}ELSE IF:`);
            lines.push(prettyPrint([node.alternate], indent + 1));
          }
        }
        lines.push(`${pad}END IF`);
        break;
      case 'section':
        lines.push(`${pad}SECTION: ${node.name}`);
        lines.push(prettyPrint(node.body, indent + 1));
        lines.push(`${pad}END SECTION`);
        break;
      case 'import':
        lines.push(`${pad}IMPORT: ${node.path}`);
        break;
      case 'include':
        lines.push(`${pad}INCLUDE: ${node.name}`);
        break;
    }
  }

  return lines.join('\n');
}

// =============================================================================
// IMPLEMENTATION NOTES
// =============================================================================

/*
NEXT STEPS TO IMPLEMENT:

1. SOURCE LOCATION HELPERS
   - mergeLocations(start, end) - Combine two locations
   - formatLocation(loc) - Human-readable format

2. AST TRANSFORMATION
   - Implement a transformer pattern for modifying AST
   - Useful for optimizations and plugin transforms

3. VALIDATION HELPERS
   - isValidVariablePath(path) - Check syntax of variable paths
   - findUndefinedVariables(ast, context) - Find missing variables

4. TESTS
   Create ast.test.ts with tests for:
   - Factory functions
   - Visitor pattern
   - AI judge collection
   - Pretty printing
*/
