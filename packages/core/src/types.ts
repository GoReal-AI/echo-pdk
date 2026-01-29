/**
 * @fileoverview Core type definitions for Echo PDK
 *
 * IMPLEMENTATION NOTES:
 * This file defines all the core types used throughout the Echo engine.
 * Keep types here to maintain a single source of truth and enable easy imports.
 */

// =============================================================================
// SOURCE LOCATION (for error messages)
// =============================================================================

/**
 * Represents a position in the source template for error reporting.
 */
export interface SourceLocation {
  /** Starting line number (1-indexed) */
  startLine: number;
  /** Starting column number (1-indexed) */
  startColumn: number;
  /** Ending line number (1-indexed) */
  endLine: number;
  /** Ending column number (1-indexed) */
  endColumn: number;
  /** Optional: the source text at this location */
  source?: string;
}

// =============================================================================
// AST NODE TYPES
// =============================================================================

/**
 * Base interface for all AST nodes.
 * Every node must have a type and location for error reporting.
 */
export interface BaseNode {
  type: string;
  location: SourceLocation;
}

/**
 * Plain text content in the template.
 * Example: "Hello world" in "Hello world {{name}}"
 */
export interface TextNode extends BaseNode {
  type: 'text';
  value: string;
}

/**
 * Variable reference in the template.
 * Example: {{user.name}} or {{value ?? "default"}}
 */
export interface VariableNode extends BaseNode {
  type: 'variable';
  /** The variable path, e.g., "user.name" or "items[0]" */
  path: string;
  /** Optional default value if variable is undefined */
  defaultValue?: string;
}

/**
 * A condition expression used in [#IF] blocks.
 */
export interface ConditionExpr {
  /** The variable being tested */
  variable: string;
  /** The operator name, e.g., 'equals', 'contains', 'ai_judge' */
  operator: string;
  /** The argument to the operator (if any) */
  argument?: string | number | string[];
  /** Flag for optimization: true if this is an AI judge condition */
  isAiJudge: boolean;
}

/**
 * Conditional block: [#IF]...[ELSE IF]...[ELSE]...[END IF]
 */
export interface ConditionalNode extends BaseNode {
  type: 'conditional';
  /** The condition to evaluate */
  condition: ConditionExpr;
  /** Nodes to render if condition is true */
  consequent: ASTNode[];
  /** Optional: ELSE IF or ELSE branch */
  alternate?: ConditionalNode | ASTNode[];
}

/**
 * Section definition: [#SECTION name="..."]...[END SECTION]
 */
export interface SectionNode extends BaseNode {
  type: 'section';
  /** The section name for later reference */
  name: string;
  /** The content of the section */
  body: ASTNode[];
}

/**
 * Import directive: [#IMPORT ./path/to/file.echo]
 */
export interface ImportNode extends BaseNode {
  type: 'import';
  /** The path to import (relative or absolute) */
  path: string;
}

/**
 * Include directive: [#INCLUDE section_name]
 */
export interface IncludeNode extends BaseNode {
  type: 'include';
  /** The name of the section to include */
  name: string;
}

/**
 * Resolved content from a context reference.
 * Contains either a data URL (for images) or inline text.
 */
export interface ResolvedContextContent {
  /** MIME type of the content, e.g., "image/png" or "text/plain" */
  mimeType: string;
  /** Base64 data URL for images: data:image/png;base64,... */
  dataUrl?: string;
  /** Inline text content for text files */
  text?: string;
}

/**
 * Context reference: #context(path)
 * Resolves to file content (image or text) from the Context Store.
 *
 * @example
 * #context(product-image)          // Reference from prompt's context mapping
 * #context(plp://logo-v2)          // Direct Context Store reference
 */
export interface ContextNode extends BaseNode {
  type: 'context';
  /** The path to the context asset (e.g., "product-image" or "plp://logo-v2") */
  path: string;
  /** Resolved content (populated during rendering) */
  resolvedContent?: ResolvedContextContent;
}

/**
 * Union type of all possible AST nodes.
 */
export type ASTNode =
  | TextNode
  | VariableNode
  | ConditionalNode
  | SectionNode
  | ImportNode
  | IncludeNode
  | ContextNode;

// =============================================================================
// OPERATOR TYPES
// =============================================================================

/**
 * Handler function for a comparison operator.
 * Called with the variable value and the operator argument.
 */
export type OperatorHandler = (
  value: unknown,
  argument?: unknown
) => boolean | Promise<boolean>;

/**
 * Definition of an operator for the plugin system.
 */
export interface OperatorDefinition {
  /** Type of operator: comparison (takes arg), unary (no arg), or ai (async) */
  type: 'comparison' | 'unary' | 'ai';
  /** The handler function */
  handler: OperatorHandler;
  /** Human-readable description */
  description: string;
  /** Example usage */
  example?: string;
  /** Autocomplete configuration for IDEs */
  autocomplete?: {
    trigger: string;
    snippet: string;
  };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * AI provider configuration for #ai_judge operator.
 */
export interface AIProviderConfig {
  /** The provider type */
  type: 'openai' | 'anthropic';
  /** API key (can also be set via ECHO_AI_API_KEY env var) */
  apiKey: string;
  /** Model to use (defaults to provider's default) */
  model?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Main Echo configuration object.
 */
export interface EchoConfig {
  /** Strict mode: fail on errors vs warn and continue */
  strict?: boolean;
  /** AI provider configuration for #ai_judge */
  aiProvider?: AIProviderConfig;
  /** Plugin paths to load */
  plugins?: string[];
  /** Language definition file path */
  languagePath?: string;
}

// =============================================================================
// RESULTS & ERRORS
// =============================================================================

/**
 * Result of parsing a template.
 */
export interface ParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  /** The AST if successful */
  ast?: ASTNode[];
  /** Errors encountered during parsing */
  errors: EchoError[];
}

/**
 * Result of validating a template.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Errors found */
  errors: EchoError[];
  /** Warnings (non-fatal issues) */
  warnings: EchoWarning[];
}

/**
 * An error in the Echo template.
 */
export interface EchoError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Location in source */
  location?: SourceLocation;
}

/**
 * A warning (non-fatal issue) in the Echo template.
 */
export interface EchoWarning {
  /** Warning code */
  code: string;
  /** Human-readable warning message */
  message: string;
  /** Location in source */
  location?: SourceLocation;
}

// =============================================================================
// PLUGIN SYSTEM
// =============================================================================

/**
 * Plugin definition for extending Echo.
 */
export interface EchoPlugin {
  /** Plugin name (unique identifier) */
  name: string;
  /** Plugin version */
  version: string;
  /** Custom operators provided by this plugin */
  operators?: Record<string, OperatorDefinition>;
  /** Hook called when plugin is loaded */
  onLoad?: () => void | Promise<void>;
}

/**
 * Helper function type for defining plugins.
 */
export type DefinePlugin = (plugin: EchoPlugin) => EchoPlugin;

// =============================================================================
// MAIN ECHO INTERFACE
// =============================================================================

/**
 * The main Echo interface for parsing and rendering templates.
 */
export interface Echo {
  /**
   * Parse a template string into an AST.
   * @param template - The Echo template string
   * @returns ParseResult with AST or errors
   */
  parse(template: string): ParseResult;

  /**
   * Render a template with the given context.
   * @param template - The Echo template string
   * @param context - Variables to substitute
   * @returns The rendered string
   */
  render(template: string, context: Record<string, unknown>): Promise<string>;

  /**
   * Validate a template for syntax and semantic errors.
   * @param template - The Echo template string
   * @returns ValidationResult with errors and warnings
   */
  validate(template: string): ValidationResult;

  /**
   * Load a language definition from a YAML file.
   * @param yamlPath - Path to the echo.lang.yaml file
   */
  loadLanguage(yamlPath: string): void;

  /**
   * Register a custom operator.
   * @param name - The operator name (without #)
   * @param definition - The operator definition
   */
  registerOperator(name: string, definition: OperatorDefinition): void;

  /**
   * Load a plugin.
   * @param plugin - The plugin to load
   */
  loadPlugin(plugin: EchoPlugin): void;
}
