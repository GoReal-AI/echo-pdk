/**
 * @fileoverview Project module entry point
 *
 * Provides utilities for creating, validating, and manipulating Echo projects.
 *
 * @example
 * ```typescript
 * import { createProject, validateProject } from '@goreal-ai/echo-pdk/project';
 *
 * // Create a new project
 * const project = createProject('my-prompt');
 *
 * // Validate project structure
 * const result = validateProject(project);
 * if (!result.valid) {
 *   console.error('Project validation failed:', result.errors);
 * }
 * ```
 */

// Re-export types
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
} from './types.js';

export {
  DEFAULT_META,
  DEFAULT_PROMPT_CONTENT,
  PROJECT_FILE_NAMES,
} from './types.js';

// Re-export meta utilities
export {
  parseMeta,
  parseMetaWithErrors,
  serializeMeta,
  mergeMeta,
  createDefaultMetaYaml,
} from './meta.js';

import type {
  EchoProject,
  PromptFile,
  MetaFile,
  ProjectValidationResult,
  ProjectValidationError,
  ProjectValidationWarning,
} from './types.js';

import {
  DEFAULT_META,
  DEFAULT_PROMPT_CONTENT,
  PROJECT_FILE_NAMES,
} from './types.js';

// =============================================================================
// PROJECT CREATION
// =============================================================================

/**
 * Options for creating a new project
 */
export interface CreateProjectOptions {
  /** Project name (defaults to "Untitled Prompt") */
  name?: string;
  /** Initial prompt content */
  promptContent?: string;
  /** Initial meta configuration */
  meta?: Partial<MetaFile>;
  /** Root path (defaults to ".") */
  root?: string;
}

/**
 * Create a new Echo project with default structure
 *
 * @param nameOrOptions - Project name or creation options
 * @returns A new EchoProject instance
 *
 * @example
 * ```typescript
 * // Simple creation
 * const project = createProject('my-prompt');
 *
 * // With options
 * const project = createProject({
 *   name: 'my-prompt',
 *   promptContent: 'Hello {{name}}!',
 *   meta: { version: '1.0.0' }
 * });
 * ```
 */
export function createProject(nameOrOptions?: string | CreateProjectOptions): EchoProject {
  const options: CreateProjectOptions =
    typeof nameOrOptions === 'string'
      ? { name: nameOrOptions }
      : nameOrOptions ?? {};

  const name = options.name ?? DEFAULT_META.name;

  const prompt: PromptFile = {
    name: PROJECT_FILE_NAMES.prompt,
    content: options.promptContent ?? DEFAULT_PROMPT_CONTENT,
  };

  const meta: MetaFile = {
    ...DEFAULT_META,
    name,
    ...options.meta,
    model: {
      ...DEFAULT_META.model,
      ...options.meta?.model,
    },
  };

  return {
    name,
    root: options.root ?? '.',
    prompt,
    meta,
    // Placeholders - not implemented yet
    context: undefined,
    testing: undefined,
  };
}

/**
 * Create a project from existing files
 *
 * @param prompt - Prompt file content
 * @param meta - Meta file content
 * @param root - Root path
 * @returns EchoProject instance
 */
export function createProjectFromFiles(
  prompt: PromptFile,
  meta: MetaFile,
  root: string = '.'
): EchoProject {
  return {
    name: meta.name,
    root,
    prompt,
    meta,
    context: undefined,
    testing: undefined,
  };
}

// =============================================================================
// PROJECT VALIDATION
// =============================================================================

/**
 * Validate an Echo project structure
 *
 * @param project - The project to validate
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const result = validateProject(project);
 * if (!result.valid) {
 *   result.errors.forEach(e => console.error(e.message));
 * }
 * ```
 */
export function validateProject(project: EchoProject): ProjectValidationResult {
  const errors: ProjectValidationError[] = [];
  const warnings: ProjectValidationWarning[] = [];

  // Validate required fields
  if (!project.name || project.name.trim() === '') {
    errors.push({
      code: 'MISSING_NAME',
      message: 'Project name is required',
    });
  }

  if (!project.prompt) {
    errors.push({
      code: 'MISSING_PROMPT',
      message: 'Prompt file is required',
    });
  } else {
    validatePromptFile(project.prompt, errors, warnings);
  }

  if (!project.meta) {
    errors.push({
      code: 'MISSING_META',
      message: 'Meta configuration is required',
    });
  } else {
    validateMetaFile(project.meta, errors, warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate prompt file
 */
function validatePromptFile(
  prompt: PromptFile,
  errors: ProjectValidationError[],
  warnings: ProjectValidationWarning[]
): void {
  if (!prompt.name || prompt.name.trim() === '') {
    errors.push({
      code: 'INVALID_PROMPT_NAME',
      message: 'Prompt file must have a name',
      file: prompt.name,
    });
  }

  if (!prompt.content || prompt.content.trim() === '') {
    warnings.push({
      code: 'EMPTY_PROMPT',
      message: 'Prompt content is empty',
      file: prompt.name,
    });
  }
}

/**
 * Validate meta configuration
 */
function validateMetaFile(
  meta: MetaFile,
  errors: ProjectValidationError[],
  warnings: ProjectValidationWarning[]
): void {
  if (!meta.name || meta.name.trim() === '') {
    errors.push({
      code: 'INVALID_META_NAME',
      message: 'Meta must have a name',
      file: PROJECT_FILE_NAMES.meta,
    });
  }

  // Validate model config if present
  if (meta.model) {
    if (
      meta.model.temperature !== undefined &&
      (meta.model.temperature < 0 || meta.model.temperature > 2)
    ) {
      warnings.push({
        code: 'INVALID_TEMPERATURE',
        message: 'Temperature should be between 0 and 2',
        file: PROJECT_FILE_NAMES.meta,
      });
    }

    if (meta.model.maxTokens !== undefined && meta.model.maxTokens < 1) {
      warnings.push({
        code: 'INVALID_MAX_TOKENS',
        message: 'maxTokens should be at least 1',
        file: PROJECT_FILE_NAMES.meta,
      });
    }
  }

  // Version format warning
  if (meta.version && !/^\d+\.\d+\.\d+/.test(meta.version)) {
    warnings.push({
      code: 'INVALID_VERSION_FORMAT',
      message: 'Version should follow semver format (e.g., 1.0.0)',
      file: PROJECT_FILE_NAMES.meta,
    });
  }
}

// =============================================================================
// PROJECT UTILITIES
// =============================================================================

/**
 * Update project prompt content
 *
 * @param project - The project to update
 * @param content - New prompt content
 * @returns Updated project (immutable)
 */
export function updateProjectPrompt(project: EchoProject, content: string): EchoProject {
  return {
    ...project,
    prompt: {
      ...project.prompt,
      content,
    },
  };
}

/**
 * Update project meta configuration
 *
 * @param project - The project to update
 * @param updates - Partial meta updates
 * @returns Updated project (immutable)
 */
export function updateProjectMeta(
  project: EchoProject,
  updates: Partial<MetaFile>
): EchoProject {
  return {
    ...project,
    meta: {
      ...project.meta,
      ...updates,
      model: {
        ...project.meta.model,
        ...updates.model,
      },
    },
    // Also update project name if meta name changed
    name: updates.name ?? project.name,
  };
}

/**
 * Get all files in a project as a flat list
 *
 * @param project - The project
 * @returns List of file paths and contents
 */
export function getProjectFiles(
  project: EchoProject
): Array<{ path: string; name: string; type: 'prompt' | 'meta' | 'context' | 'testing' }> {
  const files: Array<{
    path: string;
    name: string;
    type: 'prompt' | 'meta' | 'context' | 'testing';
  }> = [];

  // Main prompt file
  files.push({
    path: `${project.root}/${project.prompt.name}`,
    name: project.prompt.name,
    type: 'prompt',
  });

  // Meta file
  files.push({
    path: `${project.root}/${PROJECT_FILE_NAMES.meta}`,
    name: PROJECT_FILE_NAMES.meta,
    type: 'meta',
  });

  // Context files (placeholder)
  if (project.context) {
    for (const file of project.context.files) {
      files.push({
        path: `${project.root}/${project.context.path}/${file}`,
        name: file,
        type: 'context',
      });
    }
  }

  // Eval files
  if (project.testing) {
    for (const file of project.testing.evalFiles) {
      files.push({
        path: `${project.root}/${project.testing.path}/tests/${file}`,
        name: file,
        type: 'testing',
      });
    }
    for (const file of project.testing.datasetFiles) {
      files.push({
        path: `${project.root}/${project.testing.path}/datasets/${file}`,
        name: file,
        type: 'testing',
      });
    }
  }

  return files;
}

/**
 * Extract variable names from prompt content
 *
 * @param promptContent - The prompt template content
 * @returns Array of unique variable names
 */
export function extractVariablesFromPrompt(promptContent: string): string[] {
  const variablePattern = /\{\{\s*([\w.-]+)\s*(?:\?\?\s*"[^"]*")?\s*\}\}/g;
  const variables = new Set<string>();

  let match;
  while ((match = variablePattern.exec(promptContent)) !== null) {
    if (match[1]) {
      variables.add(match[1]);
    }
  }

  return Array.from(variables).sort();
}
