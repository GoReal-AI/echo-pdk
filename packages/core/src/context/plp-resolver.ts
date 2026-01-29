/**
 * @fileoverview PLP Context Resolver - Built-in resolver using PLP SDK
 *
 * This resolver fetches context from any PLP-compliant server.
 * It uses the @goreal-ai/plp-client SDK internally.
 *
 * @example
 * ```typescript
 * const echo = createEcho({
 *   plp: {
 *     serverUrl: 'https://api.echostash.com',
 *     auth: userToken, // or API key
 *   }
 * });
 *
 * // Now #context(plp://asset-id) will automatically fetch from the PLP server
 * const output = await echo.render(template, variables);
 * ```
 */

import type { ContextResolver, ContextResolveResult, ContextBatchResult } from './resolver.js';
import type { ResolvedContextContent } from '../types.js';
import { isPlpReference, extractAssetId, validateContextPath } from './resolver.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * PLP resolver configuration.
 */
export interface PlpResolverConfig {
  /** The PLP server URL (e.g., 'https://api.echostash.com') */
  serverUrl: string;
  /** Authentication token or API key */
  auth: string;
  /** Optional: prompt ID for resolving context mappings */
  promptId?: number | string;
}

/**
 * Response from PLP context-store endpoint.
 */
interface PlpAssetResponse {
  assetId: string;
  mimeType: string;
  dataUrl: string;
}

/**
 * Response from PLP prompt context resolve endpoint.
 */
interface PlpResolvedContext {
  mimeType: string;
  dataUrl?: string;
  text?: string;
}

// =============================================================================
// PLP CONTEXT RESOLVER
// =============================================================================

/**
 * Built-in PLP context resolver.
 *
 * Fetches context from a PLP-compliant server using the standard endpoints:
 * - GET /api/v1/context-store/{assetId} - for plp:// references
 * - POST /api/v1/prompts/{promptId}/context/_resolve - for prompt context mappings
 */
export class PlpContextResolver implements ContextResolver {
  private config: PlpResolverConfig;

  constructor(config: PlpResolverConfig) {
    this.config = config;
  }

  /**
   * Resolve a single context reference.
   */
  async resolve(path: string): Promise<ContextResolveResult> {
    // Validate the path first
    const validation = validateContextPath(path);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    try {
      if (isPlpReference(path)) {
        // Direct Context Store reference: plp://asset-id
        return await this.resolveFromContextStore(extractAssetId(path));
      } else {
        // Prompt context mapping: requires promptId
        if (!this.config.promptId) {
          return {
            success: false,
            error: `Context name "${path}" requires a promptId to resolve. Use plp:// prefix for direct asset references.`,
          };
        }
        return await this.resolveFromPromptContext(path);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Resolve multiple context references in batch.
   */
  async resolveBatch(paths: string[]): Promise<ContextBatchResult> {
    const results = new Map<string, ContextResolveResult>();

    // Separate plp:// references from prompt context names
    const plpRefs: string[] = [];
    const contextNames: string[] = [];

    for (const path of paths) {
      if (isPlpReference(path)) {
        plpRefs.push(path);
      } else {
        contextNames.push(path);
      }
    }

    // Resolve plp:// references individually (no batch endpoint)
    for (const path of plpRefs) {
      results.set(path, await this.resolve(path));
    }

    // Resolve prompt context names in batch if we have a promptId
    if (contextNames.length > 0 && this.config.promptId) {
      const batchResults = await this.resolvePromptContextBatch(contextNames);
      for (const [name, result] of batchResults) {
        results.set(name, result);
      }
    } else {
      // No promptId - mark as errors
      for (const name of contextNames) {
        results.set(name, {
          success: false,
          error: `Context name "${name}" requires a promptId to resolve.`,
        });
      }
    }

    return results;
  }

  /**
   * Fetch from Context Store: GET /api/v1/context-store/{assetId}
   */
  private async resolveFromContextStore(assetId: string): Promise<ContextResolveResult> {
    const url = `${this.config.serverUrl}/api/v1/context-store/${encodeURIComponent(assetId)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.auth}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: `Asset not found: ${assetId}` };
      }
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: `Unauthorized to access asset: ${assetId}` };
      }
      return { success: false, error: `Failed to fetch asset: ${response.statusText}` };
    }

    const data = await response.json() as PlpAssetResponse;

    return {
      success: true,
      content: {
        mimeType: data.mimeType,
        dataUrl: data.dataUrl,
      },
    };
  }

  /**
   * Resolve a single prompt context name.
   */
  private async resolveFromPromptContext(contextName: string): Promise<ContextResolveResult> {
    const results = await this.resolvePromptContextBatch([contextName]);
    return results.get(contextName) ?? { success: false, error: 'Unknown error' };
  }

  /**
   * Batch resolve prompt context: POST /api/v1/prompts/{promptId}/context/_resolve
   */
  private async resolvePromptContextBatch(contextNames: string[]): Promise<ContextBatchResult> {
    const results = new Map<string, ContextResolveResult>();
    const url = `${this.config.serverUrl}/api/v1/prompts/${this.config.promptId}/context/_resolve`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ contextNames }),
      });

      if (!response.ok) {
        const errorMsg = `Failed to resolve context: ${response.statusText}`;
        for (const name of contextNames) {
          results.set(name, { success: false, error: errorMsg });
        }
        return results;
      }

      const data = await response.json() as Record<string, PlpResolvedContext>;

      for (const name of contextNames) {
        const resolved = data[name];
        if (resolved) {
          const content: ResolvedContextContent = {
            mimeType: resolved.mimeType,
          };
          if (resolved.dataUrl) {
            content.dataUrl = resolved.dataUrl;
          }
          if (resolved.text) {
            content.text = resolved.text;
          }
          results.set(name, { success: true, content });
        } else {
          results.set(name, { success: false, error: `Context not found: ${name}` });
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      for (const name of contextNames) {
        results.set(name, { success: false, error: errorMsg });
      }
    }

    return results;
  }
}

/**
 * Create a PLP context resolver.
 *
 * @param config - PLP resolver configuration
 * @returns A configured PLP context resolver
 */
export function createPlpResolver(config: PlpResolverConfig): PlpContextResolver {
  return new PlpContextResolver(config);
}
