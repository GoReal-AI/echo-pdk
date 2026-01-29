/**
 * @fileoverview Browser-safe exports for Echo Language Package
 *
 * This module exports only the generated data that works in browsers.
 * It does NOT include any Node.js-specific code (fs, path, url).
 *
 * Use this for:
 * - Monaco editor integration
 * - Any browser-based editor
 * - Frontend frameworks (React, Vue, etc.)
 *
 * For Node.js usage (loading YAML files, etc.), use the main entry point.
 */

// Re-export all generated grammar data (browser-safe)
export {
  KEYWORDS,
  DIRECTIVES,
  OPERATORS,
  SNIPPETS,
  getAllAutocompleteItems,
  type Keyword,
  type DirectiveDefinition,
  type OperatorDefinition,
  type SnippetDefinition,
  type AutocompleteItem,
} from './generated/grammar-data.js';
