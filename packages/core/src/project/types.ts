/**
 * @fileoverview Project structure type definitions for Echo PDK
 *
 * Defines the structure of an Echo prompt project including:
 * - Project configuration
 * - Prompt files
 * - Meta configuration (model, provider, etc.)
 * - Placeholder types for future context/testing features
 */

// =============================================================================
// PROMPT FILE
// =============================================================================

/**
 * Represents a prompt template file (.pdk)
 */
export interface PromptFile {
  /** File name (e.g., "prompt.pdk") */
  name: string;
  /** Raw content of the prompt file */
  content: string;
}

// =============================================================================
// META CONFIGURATION
// =============================================================================

/**
 * Model configuration for the prompt
 */
export interface ModelConfig {
  /** AI provider (e.g., "openai", "anthropic") */
  provider?: string;
  /** Model identifier (e.g., "gpt-4", "claude-3-opus") */
  model?: string;
  /** Temperature setting (0-2) */
  temperature?: number;
  /** Maximum tokens in response */
  maxTokens?: number;
}

/**
 * Meta configuration for a prompt project (meta.yaml)
 */
export interface MetaFile {
  /** Human-readable name of the prompt */
  name: string;
  /** Description of what the prompt does */
  description?: string;
  /** Semantic version (e.g., "1.0.0") */
  version?: string;
  /** Author name or email */
  author?: string;
  /** Model configuration */
  model?: ModelConfig;
  /** Tags for categorization */
  tags?: string[];
}

// =============================================================================
// PLACEHOLDER TYPES (Future Sprints)
// =============================================================================

/**
 * PLACEHOLDER: Context folder for reference materials
 * Future: Will contain images, files, docs for [#context] resolution
 */
export interface ContextFolder {
  /** Folder path relative to project root */
  path: string;
  /** List of context file names */
  files: string[];
}

/**
 * PLACEHOLDER: Testing folder for evaluation files
 * Future: Will contain .eval files for prompt testing
 */
export interface TestingFolder {
  /** Folder path relative to project root */
  path: string;
  /** List of evaluation file names */
  files: string[];
}

// =============================================================================
// PROJECT STRUCTURE
// =============================================================================

/**
 * Complete Echo project structure
 *
 * @example
 * ```
 * my-prompt/
 * ├── prompt.pdk              # Main prompt template
 * ├── meta.yaml               # Model config, metadata
 * ├── context/                # PLACEHOLDER - future sprint
 * │   ├── images/
 * │   ├── files/
 * │   └── docs/
 * └── testing/                # PLACEHOLDER - future sprint
 * ```
 */
export interface EchoProject {
  /** Project name (derived from folder or meta.yaml) */
  name: string;
  /** Root path of the project */
  root: string;
  /** Main prompt file */
  prompt: PromptFile;
  /** Meta configuration */
  meta: MetaFile;
  /** Context folder (PLACEHOLDER) */
  context?: ContextFolder;
  /** Testing folder (PLACEHOLDER) */
  testing?: TestingFolder;
}

// =============================================================================
// VALIDATION RESULT
// =============================================================================

/**
 * Result of validating a project structure
 */
export interface ProjectValidationResult {
  /** Whether the project is valid */
  valid: boolean;
  /** Validation errors */
  errors: ProjectValidationError[];
  /** Validation warnings */
  warnings: ProjectValidationWarning[];
}

/**
 * A project validation error
 */
export interface ProjectValidationError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Related file path (if applicable) */
  file?: string;
}

/**
 * A project validation warning
 */
export interface ProjectValidationWarning {
  /** Warning code */
  code: string;
  /** Human-readable warning message */
  message: string;
  /** Related file path (if applicable) */
  file?: string;
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

/**
 * Default meta configuration for new projects
 */
export const DEFAULT_META: MetaFile = {
  name: 'Untitled Prompt',
  version: '1.0.0',
  model: {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
  },
};

/**
 * Default prompt content for new projects
 */
export const DEFAULT_PROMPT_CONTENT = `# My Prompt

You are a helpful assistant.

{{#IF {{context}} #exists}}
Context: {{context}}
{{/IF}}

User: {{user_input}}
`;

/**
 * Default file names
 */
export const PROJECT_FILE_NAMES = {
  prompt: 'prompt.pdk',
  meta: 'meta.yaml',
  contextDir: 'context',
  testingDir: 'testing',
} as const;
