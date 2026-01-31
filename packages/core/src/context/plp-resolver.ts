/**
 * @fileoverview PLP Context Resolver - Built-in resolver using PLP SDK
 *
 * This resolver fetches context from any PLP-compliant server.
 * It uses the @goreal-ai/plp-client SDK internally.
 *
 * @example
 * ```typescript
 * import { PLPClient } from '@goreal-ai/plp-client';
 *
 * // Option 1: Pass a PLPClient instance (preferred)
 * const plpClient = new PLPClient('https://api.echostash.com', { apiKey: token });
 * const echo = createEcho({
 *   plp: {
 *     client: plpClient,
 *     promptId: 123,
 *   }
 * });
 *
 * // Option 2: Pass serverUrl and auth (legacy)
 * const echo = createEcho({
 *   plp: {
 *     serverUrl: 'https://api.echostash.com',
 *     auth: userToken,
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

// Dynamic import PLPClient to keep it optional
let PLPClientClass: typeof import('@goreal-ai/plp-client').PLPClient | null = null;

async function getPLPClient(): Promise<typeof import('@goreal-ai/plp-client').PLPClient | null> {
  if (PLPClientClass) return PLPClientClass;
  try {
    const module = await import('@goreal-ai/plp-client');
    PLPClientClass = module.PLPClient;
    return PLPClientClass;
  } catch {
    return null;
  }
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * PLP resolver configuration.
 */
export interface PlpResolverConfig {
  /** Pre-configured PLPClient instance (preferred) */
  client?: import('@goreal-ai/plp-client').PLPClient;
  /** The PLP server URL (e.g., 'https://api.echostash.com') - required if client not provided */
  serverUrl?: string;
  /** Authentication token or API key - required if client not provided */
  auth?: string;
  /** Optional: prompt ID for resolving context mappings */
  promptId?: number | string;
}

// =============================================================================
// PLP CONTEXT RESOLVER
// =============================================================================

/**
 * Built-in PLP context resolver.
 *
 * Fetches context from a PLP-compliant server using the PLPClient SDK:
 * - client.getContextStoreAsset(assetId) - for plp:// references
 * - client.resolvePromptContext(promptId, contextNames) - for prompt context mappings
 */
export class PlpContextResolver implements ContextResolver {
  private client: import('@goreal-ai/plp-client').PLPClient | null = null;
  private config: PlpResolverConfig;
  private initPromise: Promise<void> | null = null;

  constructor(config: PlpResolverConfig) {
    this.config = config;
    if (config.client) {
      this.client = config.client;
    }
  }

  /**
   * Initialize the PLPClient if not already provided.
   * Uses dynamic import to keep @goreal-ai/plp-client optional.
   */
  private async ensureClient(): Promise<void> {
    if (this.client) return;

    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      if (!this.config.serverUrl || !this.config.auth) {
        throw new Error('PLPClient or serverUrl+auth required for PLP context resolution');
      }

      const PLPClient = await getPLPClient();
      if (!PLPClient) {
        throw new Error(
          'PLPClient not available. Install @goreal-ai/plp-client or pass a client instance.'
        );
      }

      this.client = new PLPClient(this.config.serverUrl, { apiKey: this.config.auth });
    })();

    await this.initPromise;
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
      await this.ensureClient();

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

    try {
      await this.ensureClient();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      for (const path of paths) {
        results.set(path, { success: false, error: errorMsg });
      }
      return results;
    }

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

    // Resolve plp:// references in parallel
    if (plpRefs.length > 0) {
      const plpPromises = plpRefs.map(async (path) => {
        const result = await this.resolve(path);
        return { path, result };
      });

      const plpResults = await Promise.all(plpPromises);
      for (const { path, result } of plpResults) {
        results.set(path, result);
      }
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
   * Fetch from Context Store using PLPClient SDK.
   */
  private async resolveFromContextStore(assetId: string): Promise<ContextResolveResult> {
    if (!this.client) {
      return { success: false, error: 'PLPClient not initialized' };
    }

    try {
      const data = await this.client.getContextStoreAsset(assetId);

      return {
        success: true,
        content: {
          mimeType: data.mimeType,
          dataUrl: data.dataUrl,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('404') || message.toLowerCase().includes('not found')) {
        return { success: false, error: `Asset not found: ${assetId}` };
      }
      if (message.includes('401') || message.includes('403') || message.toLowerCase().includes('unauthorized')) {
        return { success: false, error: `Unauthorized to access asset: ${assetId}` };
      }
      return { success: false, error: `Failed to fetch asset: ${message}` };
    }
  }

  /**
   * Resolve a single prompt context name.
   */
  private async resolveFromPromptContext(contextName: string): Promise<ContextResolveResult> {
    const results = await this.resolvePromptContextBatch([contextName]);
    return results.get(contextName) ?? { success: false, error: 'Unknown error' };
  }

  /**
   * Batch resolve prompt context using PLPClient SDK.
   */
  private async resolvePromptContextBatch(contextNames: string[]): Promise<ContextBatchResult> {
    const results = new Map<string, ContextResolveResult>();

    if (!this.client) {
      const errorMsg = 'PLPClient not initialized';
      for (const name of contextNames) {
        results.set(name, { success: false, error: errorMsg });
      }
      return results;
    }

    try {
      const data = await this.client.resolvePromptContext(
        String(this.config.promptId),
        contextNames
      );

      for (const name of contextNames) {
        const resolved = data[name];
        if (resolved) {
          const content: ResolvedContextContent = {
            mimeType: resolved.mimeType,
          };
          if (resolved.dataUrl) {
            content.dataUrl = resolved.dataUrl;
          }
          // Note: ResolvedContext from SDK uses dataUrl, not text
          // For text content, dataUrl will be a data:text/... URL
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
 * @param config - PLP resolver configuration (PLPClient instance or serverUrl+auth)
 * @returns A configured PLP context resolver
 *
 * @example
 * ```typescript
 * // Option 1: Pass a PLPClient instance (preferred)
 * import { PLPClient } from '@goreal-ai/plp-client';
 * const plpClient = new PLPClient('https://api.echostash.com', { apiKey: token });
 * const resolver = createPlpResolver({ client: plpClient, promptId: 123 });
 *
 * // Option 2: Pass serverUrl and auth (client created internally)
 * const resolver = createPlpResolver({
 *   serverUrl: 'https://api.echostash.com',
 *   auth: 'your-token',
 *   promptId: 123,
 * });
 * ```
 */
export function createPlpResolver(config: PlpResolverConfig): PlpContextResolver {
  // Validate that either client or serverUrl+auth is provided
  if (!config.client && (!config.serverUrl || !config.auth)) {
    throw new Error('PLPClient or serverUrl+auth required for PLP context resolution');
  }
  return new PlpContextResolver(config);
}
