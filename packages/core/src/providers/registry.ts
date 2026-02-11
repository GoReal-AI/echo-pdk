/**
 * @fileoverview Provider registry
 *
 * Static map of known providers. No runtime registration needed.
 * Adding a new provider = 1 new file + 2 entries here.
 */

import type {
  AIProviderInstance,
  ModelInfo,
  ProviderConfig,
  ProviderInfo,
  ProviderType,
} from './types.js';
import { createOpenAIProvider, OPENAI_INFO } from './openai.js';
import { createAnthropicProvider, ANTHROPIC_INFO } from './anthropic.js';

// =============================================================================
// REGISTRY
// =============================================================================

/** Known provider metadata. */
const PROVIDERS: Record<ProviderType, ProviderInfo> = {
  openai: OPENAI_INFO,
  anthropic: ANTHROPIC_INFO,
};

/** Factory functions for each provider. */
const FACTORIES: Record<ProviderType, (config: ProviderConfig) => AIProviderInstance> = {
  openai: createOpenAIProvider,
  anthropic: createAnthropicProvider,
};

/** Set of valid provider type strings for runtime validation. */
const VALID_TYPES = new Set<string>(Object.keys(PROVIDERS));

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Check if a string is a valid provider type.
 *
 * Use this to validate user input or config values before passing them
 * to functions that expect a ProviderType.
 *
 * @param value - String to check
 * @returns true if value is a known ProviderType
 *
 * @example
 * ```typescript
 * const raw = config.provider; // string
 * if (isProviderType(raw)) {
 *   createProvider({ type: raw, apiKey: '...' });
 * }
 * ```
 */
export function isProviderType(value: string): value is ProviderType {
  return VALID_TYPES.has(value);
}

/**
 * Get metadata for all known providers.
 *
 * @returns Array of ProviderInfo for all registered providers
 *
 * @example
 * ```typescript
 * const providers = getProviders();
 * // → [{ type: 'openai', name: 'OpenAI', ... }, { type: 'anthropic', name: 'Anthropic', ... }]
 * ```
 */
export function getProviders(): ProviderInfo[] {
  return Object.values(PROVIDERS);
}

/**
 * Get metadata for a specific provider.
 *
 * @param type - Provider type
 * @returns ProviderInfo for the requested provider
 * @throws If provider type is unknown
 */
export function getProvider(type: ProviderType): ProviderInfo {
  const info = PROVIDERS[type];
  if (!info) {
    throw new Error(`Unknown provider type: ${type}`);
  }
  return info;
}

/**
 * Create a configured provider instance.
 *
 * @param config - Provider configuration with type and API key
 * @returns AIProviderInstance ready to use
 * @throws If provider type is unknown or config is invalid
 *
 * @example
 * ```typescript
 * const provider = createProvider({
 *   type: 'openai',
 *   apiKey: 'sk-...',
 *   model: 'gpt-4o',
 * });
 * const response = await provider.complete([{ role: 'user', content: 'Hello' }]);
 * ```
 */
export function createProvider(config: ProviderConfig): AIProviderInstance {
  const factory = FACTORIES[config.type];
  if (!factory) {
    throw new Error(`Unknown provider type: ${config.type}`);
  }
  return factory(config);
}

/**
 * Convenience: list models for a provider type.
 * Creates a temporary provider instance, calls listModels(), and returns the result.
 *
 * @param type - Provider type
 * @param apiKey - API key for authentication
 * @param baseUrl - Optional custom base URL
 * @returns Array of ModelInfo from the live API
 *
 * @example
 * ```typescript
 * const models = await listModels('openai', 'sk-...');
 * // → [{ id: 'gpt-4o', provider: 'openai', ... }, ...]
 * ```
 */
export async function listModels(
  type: ProviderType,
  apiKey: string,
  baseUrl?: string
): Promise<ModelInfo[]> {
  const provider = createProvider({ type, apiKey, baseUrl });
  return provider.listModels();
}
