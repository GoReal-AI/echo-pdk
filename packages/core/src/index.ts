/**
 * @fileoverview Echo PDK Core - Main entry point
 *
 * This is the main entry point for @echo-pdk/core.
 * It exports the createEcho factory function and all public types.
 *
 * IMPLEMENTATION NOTES:
 * - The createEcho function creates a configured Echo instance
 * - It wires together the parser, evaluator, and renderer
 * - Plugins are loaded and operators registered during initialization
 */

// Re-export all types
export type {
  // AST Types
  ASTNode,
  TextNode,
  VariableNode,
  ConditionalNode,
  SectionNode,
  ImportNode,
  IncludeNode,
  ConditionExpr,
  SourceLocation,
  // Configuration
  EchoConfig,
  AIProviderConfig,
  // Results
  ParseResult,
  ValidationResult,
  EchoError,
  EchoWarning,
  // Operators & Plugins
  OperatorDefinition,
  OperatorHandler,
  EchoPlugin,
  // Main interface
  Echo,
} from './types.js';

import type {
  Echo,
  EchoConfig,
  ParseResult,
  ValidationResult,
  OperatorDefinition,
  EchoPlugin,
} from './types.js';

// Import submodules (to be implemented)
// import { createLexer } from './parser/lexer.js';
// import { createParser } from './parser/parser.js';
// import { createEvaluator } from './evaluator/evaluator.js';
// import { createRenderer } from './renderer/renderer.js';
// import { builtinOperators } from './evaluator/operators.js';

/**
 * Creates a new Echo instance with the given configuration.
 *
 * @param config - Configuration options for the Echo instance
 * @returns A configured Echo instance
 *
 * @example
 * ```typescript
 * import { createEcho } from '@echo-pdk/core';
 *
 * const echo = createEcho({
 *   strict: true,
 *   aiProvider: {
 *     type: 'openai',
 *     apiKey: process.env.OPENAI_API_KEY
 *   }
 * });
 *
 * const result = await echo.render(template, { name: 'Alice' });
 * ```
 */
export function createEcho(_config: EchoConfig = {}): Echo {
  // TODO: Implementation
  //
  // IMPLEMENTATION STEPS:
  // 1. Initialize the lexer (from ./parser/lexer.ts)
  // 2. Initialize the parser (from ./parser/parser.ts)
  // 3. Initialize the evaluator with config (from ./evaluator/evaluator.ts)
  // 4. Initialize the renderer (from ./renderer/renderer.ts)
  // 5. Register built-in operators
  // 6. Load plugins if specified in config
  // 7. Return the Echo interface implementation

  const operators = new Map<string, OperatorDefinition>();
  const plugins: EchoPlugin[] = [];

  // Placeholder implementation - replace with actual implementation
  const echo: Echo = {
    parse(_template: string): ParseResult {
      // TODO: Implement using lexer and parser
      // 1. Tokenize with lexer
      // 2. Parse tokens into AST
      // 3. Return ParseResult with AST or errors
      throw new Error('Not implemented: parse()');
    },

    async render(
      _template: string,
      _context: Record<string, unknown>
    ): Promise<string> {
      // TODO: Implement full render pipeline
      // 1. Parse template to AST
      // 2. Collect all AI judge conditions
      // 3. Evaluate AI judges in parallel (optimization!)
      // 4. Evaluate AST with context + resolved AI judges
      // 5. Render evaluated AST to string
      throw new Error('Not implemented: render()');
    },

    validate(_template: string): ValidationResult {
      // TODO: Implement validation
      // 1. Parse template
      // 2. Check for undefined variables (if context schema available)
      // 3. Check for unknown operators
      // 4. Check for unclosed blocks
      // 5. Return ValidationResult
      throw new Error('Not implemented: validate()');
    },

    loadLanguage(_yamlPath: string): void {
      // TODO: Implement language loading
      // 1. Read YAML file
      // 2. Parse language definition
      // 3. Register operators from definition
      // 4. Store validation rules
      throw new Error('Not implemented: loadLanguage()');
    },

    registerOperator(name: string, definition: OperatorDefinition): void {
      operators.set(name, definition);
    },

    loadPlugin(plugin: EchoPlugin): void {
      plugins.push(plugin);

      // Register plugin operators
      if (plugin.operators) {
        for (const [name, definition] of Object.entries(plugin.operators)) {
          operators.set(name, definition);
        }
      }

      // Call plugin's onLoad hook
      if (plugin.onLoad) {
        void plugin.onLoad();
      }
    },
  };

  return echo;
}

/**
 * Helper function for defining plugins with type safety.
 *
 * @param plugin - The plugin definition
 * @returns The same plugin (for type inference)
 *
 * @example
 * ```typescript
 * import { definePlugin } from '@echo-pdk/core';
 *
 * export default definePlugin({
 *   name: 'my-operators',
 *   version: '1.0.0',
 *   operators: {
 *     isEmpty: {
 *       type: 'unary',
 *       handler: (value) => !value,
 *       description: 'Check if value is empty'
 *     }
 *   }
 * });
 * ```
 */
export function definePlugin(plugin: EchoPlugin): EchoPlugin {
  return plugin;
}
