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

// PLP Resolver - Built-in resolver using PLP protocol
export {
  type PlpResolverConfig,
  PlpContextResolver,
  createPlpResolver,
} from './plp-resolver.js';
