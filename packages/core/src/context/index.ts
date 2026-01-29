/**
 * @fileoverview Context Module - Context reference resolution
 *
 * This module provides utilities for resolving #context() references.
 */

export {
  // Types
  type ContextResolver,
  type ContextResolveResult,
  type ContextBatchResult,

  // Validation
  isPlpReference,
  extractAssetId,
  validateContextPath,

  // AST Helpers
  collectContextPaths,
  applyResolvedContext,

  // Mock Resolver
  MockContextResolver,
} from './resolver.js';
