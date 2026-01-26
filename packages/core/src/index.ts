/**
 * @fileoverview Echo PDK Core - Main entry point
 *
 * This is the main entry point for @goreal-ai/echo-pdk.
 * It exports the createEcho factory function and all public types.
 *
 * @example
 * ```typescript
 * import { createEcho } from '@goreal-ai/echo-pdk';
 *
 * const echo = createEcho({
 *   strict: false,
 *   aiProvider: {
 *     type: 'openai',
 *     apiKey: process.env.OPENAI_API_KEY,
 *   }
 * });
 *
 * const result = await echo.render(template, { name: 'Alice' });
 * ```
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
  EchoError,
  EchoWarning,
} from './types.js';

// Import submodules
import { parse } from './parser/parser.js';
import { evaluate } from './evaluator/evaluator.js';
import { render, formatErrors } from './renderer/renderer.js';
import { builtinOperators, getOperator } from './evaluator/operators.js';
import { createOpenAIProvider, withCache } from './ai-judge/index.js';

// Re-export utilities for advanced usage
export { parse } from './parser/parser.js';
export {
  evaluate,
  resolveVariable,
  type ResolveVariableOptions,
} from './evaluator/evaluator.js';
export { render, renderTemplate, formatErrors } from './renderer/renderer.js';
export { builtinOperators, getOperator } from './evaluator/operators.js';
export {
  createTextNode,
  createVariableNode,
  createConditionalNode,
  createConditionExpr,
  createSectionNode,
  createImportNode,
  createIncludeNode,
  collectAiJudgeConditions,
  visitNode,
  visitNodes,
  prettyPrint,
} from './parser/ast.js';

/**
 * Environment variable name for API key.
 */
const ENV_API_KEY = 'OPENAI_API_KEY';
const ENV_ECHO_API_KEY = 'ECHO_API_KEY';

/**
 * Creates a new Echo instance with the given configuration.
 *
 * The Echo instance provides methods for parsing, validating, and rendering
 * Echo templates with support for:
 * - Variable interpolation: {{name}}, {{user.email}}
 * - Conditionals: [#IF {{var}} #operator(arg)]...[END IF]
 * - Sections: [#SECTION name="x"]...[END SECTION]
 * - Includes: [#INCLUDE section_name]
 * - AI-powered conditions: #ai_judge(question)
 *
 * @param config - Configuration options for the Echo instance
 * @returns A configured Echo instance
 *
 * @example Basic usage
 * ```typescript
 * import { createEcho } from '@goreal-ai/echo-pdk';
 *
 * const echo = createEcho();
 * const output = await echo.render('Hello {{name}}!', { name: 'World' });
 * // Output: "Hello World!"
 * ```
 *
 * @example With AI provider
 * ```typescript
 * const echo = createEcho({
 *   aiProvider: {
 *     type: 'openai',
 *     apiKey: process.env.OPENAI_API_KEY,
 *     model: 'gpt-4o-mini',
 *   }
 * });
 *
 * const template = `
 * [#IF {{content}} #ai_judge(Is this appropriate for children?)]
 *   Safe content: {{content}}
 * [ELSE]
 *   Content flagged for review.
 * [END IF]
 * `;
 *
 * const output = await echo.render(template, { content: userContent });
 * ```
 *
 * @example With plugins
 * ```typescript
 * const echo = createEcho();
 *
 * echo.loadPlugin({
 *   name: 'custom-operators',
 *   version: '1.0.0',
 *   operators: {
 *     isEmpty: {
 *       type: 'unary',
 *       handler: (value) => !value || value === '',
 *       description: 'Check if value is empty',
 *     }
 *   }
 * });
 * ```
 */
export function createEcho(config: EchoConfig = {}): Echo {
  // Custom operators registry (starts with built-in operators)
  const operators = new Map<string, OperatorDefinition>();

  // Register all built-in operators
  for (const [name, definition] of Object.entries(builtinOperators)) {
    operators.set(name, definition);
  }

  // Set up AI Judge operator if provider is configured
  setupAiJudgeOperator(config, operators);

  // Loaded plugins
  const plugins: EchoPlugin[] = [];

  // The Echo instance
  const echo: Echo = {
    /**
     * Parse a template string into an AST.
     */
    parse(template: string): ParseResult {
      return parse(template);
    },

    /**
     * Render a template with the given context.
     */
    async render(
      template: string,
      context: Record<string, unknown>
    ): Promise<string> {
      // Step 1: Parse
      const parseResult = parse(template);

      if (!parseResult.success || !parseResult.ast) {
        const formattedErrors = formatErrors(template, parseResult.errors);
        throw new Error(`Parse error:\n${formattedErrors}`);
      }

      // Step 2: Evaluate
      const { ast: evaluatedAst } = await evaluate(
        parseResult.ast,
        context,
        config,
        operators
      );

      // Step 3: Render
      return render(evaluatedAst, {
        context,
        config,
        trim: false,
        collapseNewlines: true,
      });
    },

    /**
     * Validate a template for syntax and semantic errors.
     */
    validate(template: string): ValidationResult {
      const errors: EchoError[] = [];
      const warnings: EchoWarning[] = [];

      // Step 1: Parse the template
      const parseResult = parse(template);

      if (!parseResult.success) {
        return {
          valid: false,
          errors: parseResult.errors,
          warnings: [],
        };
      }

      // Step 2: Semantic validation
      if (parseResult.ast) {
        validateAst(parseResult.ast, errors, warnings, config, operators);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    },

    /**
     * Load a language definition from a YAML file.
     */
    loadLanguage(_yamlPath: string): void {
      // TODO: Implement language loading
      // This would load custom operator definitions from a YAML file
      // For now, we use the built-in operators
      throw new Error(
        'Language loading not yet implemented. Use registerOperator() to add custom operators.'
      );
    },

    /**
     * Register a custom operator.
     */
    registerOperator(name: string, definition: OperatorDefinition): void {
      operators.set(name, definition);
    },

    /**
     * Load a plugin.
     */
    loadPlugin(plugin: EchoPlugin): void {
      // Validate plugin structure
      if (!plugin.name || typeof plugin.name !== 'string') {
        throw new Error('Plugin must have a name');
      }
      if (!plugin.version || typeof plugin.version !== 'string') {
        throw new Error('Plugin must have a version');
      }

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

  // Load plugins specified in config
  if (config.plugins && config.plugins.length > 0) {
    // TODO: Implement plugin path loading
    // For now, plugins must be loaded via loadPlugin()
    console.warn(
      'Plugin paths in config not yet supported. Use loadPlugin() instead.'
    );
  }

  return echo;
}

/**
 * Set up the AI Judge operator with the configured provider.
 */
function setupAiJudgeOperator(
  config: EchoConfig,
  operators: Map<string, OperatorDefinition>
): void {
  // Check for API key from config or environment
  const apiKey =
    config.aiProvider?.apiKey ||
    process.env[ENV_ECHO_API_KEY] ||
    process.env[ENV_API_KEY];

  if (!apiKey) {
    // No API key - AI Judge will throw when used
    return;
  }

  // Create the provider based on type
  const providerType = config.aiProvider?.type ?? 'openai';

  if (providerType !== 'openai') {
    console.warn(`AI provider type '${providerType}' not yet supported. Using OpenAI.`);
  }

  try {
    // Resolve the model (default to gpt-4o-mini)
    const model = config.aiProvider?.model ?? 'gpt-4o-mini';

    // Create OpenAI provider with caching
    const provider = createOpenAIProvider({
      type: 'openai',
      apiKey,
      model,
      timeout: config.aiProvider?.timeout,
    });

    // Wrap with cache, including provider/model for cache key isolation
    const cachedProvider = withCache(provider, {
      providerType: providerType,
      model,
    });

    // Register the AI Judge operator with the provider
    operators.set('ai_judge', {
      type: 'ai',
      description: 'LLM-evaluated boolean condition',
      example: '{{content}} #ai_judge(Is this appropriate?)',
      handler: async (value: unknown, question: unknown): Promise<boolean> => {
        if (typeof question !== 'string') {
          throw new Error('AI Judge requires a question string as argument');
        }
        return cachedProvider.evaluate(value, question);
      },
    });
  } catch (error) {
    // Provider creation failed - AI Judge will throw when used
    console.warn('Failed to create AI provider:', error);
  }
}

/**
 * Validate the AST for semantic errors.
 */
function validateAst(
  ast: import('./types.js').ASTNode[],
  errors: EchoError[],
  warnings: EchoWarning[],
  config: EchoConfig,
  operators: Map<string, OperatorDefinition>
): void {
  const knownSections = new Set<string>();

  // First pass: collect section names
  collectSectionNames(ast, knownSections);

  // Second pass: validate
  validateNodes(ast, errors, warnings, knownSections, config, operators);
}

/**
 * Collect all section names from the AST.
 */
function collectSectionNames(
  nodes: import('./types.js').ASTNode[],
  sections: Set<string>
): void {
  for (const node of nodes) {
    if (node.type === 'section') {
      sections.add(node.name);
      collectSectionNames(node.body, sections);
    } else if (node.type === 'conditional') {
      collectSectionNames(node.consequent, sections);
      if (node.alternate) {
        if (Array.isArray(node.alternate)) {
          collectSectionNames(node.alternate, sections);
        } else {
          collectSectionNames([node.alternate], sections);
        }
      }
    }
  }
}

/**
 * Validate AST nodes for semantic errors.
 */
function validateNodes(
  nodes: import('./types.js').ASTNode[],
  errors: EchoError[],
  warnings: EchoWarning[],
  knownSections: Set<string>,
  config: EchoConfig,
  operators: Map<string, OperatorDefinition>
): void {
  for (const node of nodes) {
    switch (node.type) {
      case 'conditional': {
        // Check if operator exists in instance operators or built-in operators
        const operatorName = node.condition.operator;
        const operator = operators.get(operatorName) ?? getOperator(operatorName);
        if (!operator) {
          const error: EchoError = {
            code: 'UNKNOWN_OPERATOR',
            message: `Unknown operator: #${operatorName}`,
            location: node.location,
          };
          if (config.strict) {
            errors.push(error);
          } else {
            warnings.push(error);
          }
        }

        // Recurse into branches
        validateNodes(node.consequent, errors, warnings, knownSections, config, operators);
        if (node.alternate) {
          if (Array.isArray(node.alternate)) {
            validateNodes(node.alternate, errors, warnings, knownSections, config, operators);
          } else {
            validateNodes([node.alternate], errors, warnings, knownSections, config, operators);
          }
        }
        break;
      }

      case 'include': {
        // Check if section exists
        if (!knownSections.has(node.name)) {
          const error: EchoError = {
            code: 'UNKNOWN_SECTION',
            message: `Unknown section: ${node.name}`,
            location: node.location,
          };
          if (config.strict) {
            errors.push(error);
          } else {
            warnings.push(error);
          }
        }
        break;
      }

      case 'section': {
        // Recurse into section body
        validateNodes(node.body, errors, warnings, knownSections, config, operators);
        break;
      }

      case 'import': {
        // Warn about imports (not yet fully supported)
        warnings.push({
          code: 'IMPORT_NOT_RESOLVED',
          message: `Import will not be resolved: ${node.path}`,
          location: node.location,
        });
        break;
      }
    }
  }
}
/**
 * Helper function for defining plugins with type safety.
 *
 * @param plugin - The plugin definition
 * @returns The same plugin (for type inference)
 *
 * @example
 * ```typescript
 * import { definePlugin } from '@goreal-ai/echo-pdk';
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

// =============================================================================
// PROJECT MODULE
// =============================================================================

// Re-export project types
export type {
  EchoProject,
  PromptFile,
  MetaFile,
  ModelConfig,
  ContextFolder,
  TestingFolder,
  ProjectValidationResult,
  ProjectValidationError,
  ProjectValidationWarning,
  CreateProjectOptions,
} from './project/index.js';

// Re-export project functions
export {
  createProject,
  createProjectFromFiles,
  validateProject,
  updateProjectPrompt,
  updateProjectMeta,
  getProjectFiles,
  extractVariablesFromPrompt,
  parseMeta,
  parseMetaWithErrors,
  serializeMeta,
  mergeMeta,
  createDefaultMetaYaml,
  DEFAULT_META,
  DEFAULT_PROMPT_CONTENT,
  PROJECT_FILE_NAMES,
} from './project/index.js';
