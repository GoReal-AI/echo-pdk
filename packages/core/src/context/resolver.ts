/**
 * @fileoverview Context Resolver - Interface for resolving context references
 *
 * This file defines the interface for resolving #context() references.
 * The resolver fetches content from the Context Store and returns it in
 * a format suitable for LLM consumption.
 *
 * USAGE PATTERNS:
 *
 * 1. Echostash Backend - Resolves from GCP Storage
 *    - Uses signed URLs
 *    - Verifies ownership
 *    - Returns base64 data URLs
 *
 * 2. SDK/Client - Resolves via PLP API
 *    - Uses API key for auth
 *    - Fetches from /context-store endpoint
 *    - Returns resolved content
 *
 * 3. Playground - Mock resolver for testing
 *    - Uses local files or fixtures
 *    - No auth required
 */

import type { ContextNode, ResolvedContextContent } from '../types.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result from resolving a single context reference.
 */
export interface ContextResolveResult {
  /** Whether resolution succeeded */
  success: boolean;
  /** The resolved content (if successful) */
  content?: ResolvedContextContent;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Batch resolution result.
 * Maps context paths to their resolved content.
 */
export type ContextBatchResult = Map<string, ContextResolveResult>;

/**
 * Context resolver interface.
 *
 * Implementations should:
 * 1. Validate the context path format
 * 2. Authenticate and authorize access
 * 3. Fetch the content from storage
 * 4. Convert to base64 for images or text for text files
 *
 * @example
 * ```typescript
 * class EchostashContextResolver implements ContextResolver {
 *   async resolve(path: string): Promise<ContextResolveResult> {
 *     // Validate path
 *     if (!isValidContextPath(path)) {
 *       return { success: false, error: 'Invalid context path' };
 *     }
 *
 *     // Fetch from GCP Storage
 *     const asset = await this.fetchFromGcp(path);
 *     return {
 *       success: true,
 *       content: {
 *         mimeType: asset.mimeType,
 *         dataUrl: `data:${asset.mimeType};base64,${asset.base64}`,
 *       },
 *     };
 *   }
 * }
 * ```
 */
export interface ContextResolver {
  /**
   * Resolve a single context reference.
   *
   * @param path - The context path (e.g., "product-image" or "plp://logo-v2")
   * @returns The resolved content or error
   */
  resolve(path: string): Promise<ContextResolveResult>;

  /**
   * Resolve multiple context references in batch.
   * More efficient than calling resolve() multiple times.
   *
   * @param paths - Array of context paths
   * @returns Map of path to resolved content
   */
  resolveBatch?(paths: string[]): Promise<ContextBatchResult>;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Regex for valid asset IDs: alphanumeric, hyphens, underscores only.
 */
const ASSET_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Regex for valid context filenames: no path traversal.
 */
const FILENAME_PATTERN = /^[a-zA-Z0-9_.-]{1,128}$/;

/**
 * Check if a context path is a direct Context Store reference (plp:// prefix).
 *
 * @param path - The context path
 * @returns True if it's a plp:// reference
 */
export function isPlpReference(path: string): boolean {
  return path.startsWith('plp://');
}

/**
 * Extract the asset ID from a plp:// reference.
 *
 * @param path - The context path (e.g., "plp://logo-v2")
 * @returns The asset ID (e.g., "logo-v2")
 */
export function extractAssetId(path: string): string {
  if (!isPlpReference(path)) {
    return path;
  }
  return path.slice(6); // Remove "plp://" prefix
}

/**
 * Validate a context path.
 *
 * @param path - The context path to validate
 * @returns Object with isValid flag and optional error message
 *
 * @example
 * ```typescript
 * validateContextPath('product-image'); // { isValid: true }
 * validateContextPath('plp://logo-v2'); // { isValid: true }
 * validateContextPath('../etc/passwd'); // { isValid: false, error: '...' }
 * validateContextPath('https://evil.com'); // { isValid: false, error: '...' }
 * ```
 */
export function validateContextPath(path: string): { isValid: boolean; error?: string } {
  // Empty path
  if (!path || path.trim().length === 0) {
    return { isValid: false, error: 'Context path cannot be empty' };
  }

  // Path traversal prevention
  if (path.includes('..')) {
    return { isValid: false, error: 'Context path cannot contain path traversal (..)' };
  }

  // URL injection prevention - only plp:// is allowed
  if (path.includes('://') && !isPlpReference(path)) {
    return { isValid: false, error: 'Only plp:// references are allowed (no external URLs)' };
  }

  // Encoded character prevention
  if (path.includes('%')) {
    return { isValid: false, error: 'Context path cannot contain encoded characters' };
  }

  // Validate the asset ID or filename
  const assetId = extractAssetId(path);

  if (isPlpReference(path)) {
    // Validate as asset ID
    if (!ASSET_ID_PATTERN.test(assetId)) {
      return {
        isValid: false,
        error: `Invalid asset ID: must be 1-64 alphanumeric characters, hyphens, or underscores`,
      };
    }
  } else {
    // Validate as filename
    if (!FILENAME_PATTERN.test(path)) {
      return {
        isValid: false,
        error: `Invalid context name: must be 1-128 alphanumeric characters, hyphens, underscores, or dots`,
      };
    }
  }

  return { isValid: true };
}

// =============================================================================
// AST HELPERS
// =============================================================================

/**
 * Collect all context references from an AST.
 *
 * @param ast - The AST nodes to search
 * @returns Array of unique context paths
 */
export function collectContextPaths(ast: import('../types.js').ASTNode[]): string[] {
  const paths = new Set<string>();

  function walkNodes(nodes: import('../types.js').ASTNode[]): void {
    for (const node of nodes) {
      if (node.type === 'context') {
        paths.add(node.path);
      } else if (node.type === 'conditional') {
        walkNodes(node.consequent);
        if (node.alternate) {
          if (Array.isArray(node.alternate)) {
            walkNodes(node.alternate);
          } else {
            walkNodes([node.alternate]);
          }
        }
      } else if (node.type === 'section') {
        walkNodes(node.body);
      }
    }
  }

  walkNodes(ast);
  return Array.from(paths);
}

/**
 * Apply resolved content to context nodes in the AST.
 *
 * This modifies the AST in place, setting the resolvedContent
 * on each ContextNode.
 *
 * @param ast - The AST nodes to update
 * @param resolved - Map of path to resolved content
 */
export function applyResolvedContext(
  ast: import('../types.js').ASTNode[],
  resolved: ContextBatchResult
): void {
  function walkNodes(nodes: import('../types.js').ASTNode[]): void {
    for (const node of nodes) {
      if (node.type === 'context') {
        const result = resolved.get(node.path);
        if (result?.success && result.content) {
          (node as ContextNode).resolvedContent = result.content;
        }
      } else if (node.type === 'conditional') {
        walkNodes(node.consequent);
        if (node.alternate) {
          if (Array.isArray(node.alternate)) {
            walkNodes(node.alternate);
          } else {
            walkNodes([node.alternate]);
          }
        }
      } else if (node.type === 'section') {
        walkNodes(node.body);
      }
    }
  }

  walkNodes(ast);
}

// =============================================================================
// MOCK RESOLVER (for testing)
// =============================================================================

/**
 * A mock resolver that returns test data.
 * Useful for unit tests and playground.
 */
export class MockContextResolver implements ContextResolver {
  private mockData: Map<string, ResolvedContextContent>;

  constructor(data?: Record<string, ResolvedContextContent>) {
    this.mockData = new Map(Object.entries(data ?? {}));
  }

  /**
   * Add mock data for a context path.
   */
  addMock(path: string, content: ResolvedContextContent): void {
    this.mockData.set(path, content);
  }

  async resolve(path: string): Promise<ContextResolveResult> {
    // Validate the path first
    const validation = validateContextPath(path);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // Check for mock data
    const content = this.mockData.get(path);
    if (content) {
      return { success: true, content };
    }

    // No mock data found
    return {
      success: false,
      error: `Context not found: ${path}`,
    };
  }

  async resolveBatch(paths: string[]): Promise<ContextBatchResult> {
    const results = new Map<string, ContextResolveResult>();

    for (const path of paths) {
      results.set(path, await this.resolve(path));
    }

    return results;
  }
}
