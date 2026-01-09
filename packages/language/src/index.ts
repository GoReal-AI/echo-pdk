/**
 * @fileoverview Echo Language Package - Language definition and schema
 *
 * This package provides:
 * - The echo.lang.yaml language definition
 * - JSON Schema for echo.config.yaml validation
 * - TypeScript types for language structures
 * - Utilities for loading and parsing language definitions
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

// Get the package directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = join(__dirname, '..');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Operator type in the language definition.
 */
export type OperatorType = 'comparison' | 'unary' | 'ai';

/**
 * Operator definition from echo.lang.yaml.
 */
export interface LanguageOperator {
  type: OperatorType;
  signature: string;
  description: string;
  example: string;
  autocomplete?: {
    trigger: string;
    snippet: string;
  };
  config?: Record<string, unknown>;
}

/**
 * Syntax pattern definition.
 */
export interface SyntaxPattern {
  pattern?: string;
  open?: string;
  close?: string;
  captures?: Record<number, string>;
  description: string;
  examples: string[];
}

/**
 * Validation rule definition.
 */
export interface ValidationRule {
  level: 'error' | 'warning';
  description: string;
  message: string;
}

/**
 * Complete language definition structure.
 */
export interface LanguageDefinition {
  name: string;
  version: string;
  description: string;
  fileExtensions: string[];
  syntax: Record<string, SyntaxPattern>;
  operators: Record<string, LanguageOperator>;
  validation: Record<string, ValidationRule>;
  extensibility: {
    customOperators: {
      interface: string;
    };
    pluginEntry: string;
    pluginExample: string;
  };
}

// =============================================================================
// LOADING FUNCTIONS
// =============================================================================

/**
 * Load the default Echo language definition.
 *
 * @returns The parsed language definition
 */
export function loadDefaultLanguage(): LanguageDefinition {
  const yamlPath = join(packageDir, 'echo.lang.yaml');
  return loadLanguageFromPath(yamlPath);
}

/**
 * Load a language definition from a file path.
 *
 * @param path - Path to the YAML file
 * @returns The parsed language definition
 */
export function loadLanguageFromPath(path: string): LanguageDefinition {
  const content = readFileSync(path, 'utf-8');
  const parsed = parseYaml(content) as LanguageDefinition;

  // TODO: Validate the structure
  validateLanguageDefinition(parsed);

  return parsed;
}

/**
 * Validate a language definition structure.
 *
 * @param def - The definition to validate
 * @throws If the definition is invalid
 */
export function validateLanguageDefinition(
  def: unknown
): asserts def is LanguageDefinition {
  if (!def || typeof def !== 'object') {
    throw new Error('Language definition must be an object');
  }

  const d = def as Record<string, unknown>;

  if (typeof d.name !== 'string') {
    throw new Error('Language definition must have a name');
  }

  if (typeof d.version !== 'string') {
    throw new Error('Language definition must have a version');
  }

  if (typeof d.operators !== 'object' || d.operators === null) {
    throw new Error('Language definition must have operators');
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get all operator names from the language definition.
 */
export function getOperatorNames(lang: LanguageDefinition): string[] {
  return Object.keys(lang.operators);
}

/**
 * Get operator details by name.
 */
export function getOperator(
  lang: LanguageDefinition,
  name: string
): LanguageOperator | undefined {
  return lang.operators[name];
}

/**
 * Get all autocomplete triggers for IDE integration.
 */
export function getAutocompleteTriggers(
  lang: LanguageDefinition
): Array<{ trigger: string; snippet: string; description: string }> {
  const triggers: Array<{
    trigger: string;
    snippet: string;
    description: string;
  }> = [];

  for (const [name, op] of Object.entries(lang.operators)) {
    if (op.autocomplete) {
      triggers.push({
        trigger: op.autocomplete.trigger,
        snippet: op.autocomplete.snippet,
        description: op.description,
      });
    }
  }

  return triggers;
}

/**
 * Get validation rules from the language definition.
 */
export function getValidationRules(
  lang: LanguageDefinition
): Record<string, ValidationRule> {
  return lang.validation;
}

// =============================================================================
// EXPORTS
// =============================================================================

// Re-export types
export type {
  LanguageDefinition,
  LanguageOperator,
  SyntaxPattern,
  ValidationRule,
  OperatorType,
};

// Export path to language files for direct access
export const LANGUAGE_FILE_PATH = join(packageDir, 'echo.lang.yaml');
export const CONFIG_SCHEMA_PATH = join(packageDir, 'echo.config.schema.json');
