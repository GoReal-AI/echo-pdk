/**
 * @fileoverview Meta.yaml parsing and serialization
 *
 * Handles parsing and serializing project metadata in YAML format.
 */

import YAML from 'yaml';
import type { MetaFile, ModelConfig } from './types.js';
import { DEFAULT_META } from './types.js';

// =============================================================================
// PARSING
// =============================================================================

/**
 * Parse meta.yaml content into a MetaFile object
 *
 * @param content - Raw YAML string content
 * @returns Parsed MetaFile or null if parsing fails
 *
 * @example
 * ```typescript
 * const meta = parseMeta(`
 *   name: My Prompt
 *   version: 1.0.0
 *   model:
 *     provider: openai
 *     model: gpt-4o
 * `);
 * // { name: 'My Prompt', version: '1.0.0', model: { provider: 'openai', model: 'gpt-4o' } }
 * ```
 */
export function parseMeta(content: string): MetaFile | null {
  try {
    const parsed = YAML.parse(content);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return validateAndNormalizeMeta(parsed);
  } catch {
    return null;
  }
}

/**
 * Parse meta.yaml content with detailed error reporting
 *
 * @param content - Raw YAML string content
 * @returns Object with parsed meta or error details
 */
export function parseMetaWithErrors(content: string): {
  meta: MetaFile | null;
  error: string | null;
} {
  try {
    const parsed = YAML.parse(content);
    if (!parsed || typeof parsed !== 'object') {
      return { meta: null, error: 'Invalid YAML: expected an object' };
    }
    const meta = validateAndNormalizeMeta(parsed);
    if (!meta) {
      return { meta: null, error: 'Invalid meta structure' };
    }
    return { meta, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown parsing error';
    return { meta: null, error: message };
  }
}

/**
 * Validate and normalize a parsed meta object
 */
function validateAndNormalizeMeta(obj: unknown): MetaFile | null {
  if (!obj || typeof obj !== 'object') {
    return null;
  }

  const raw = obj as Record<string, unknown>;

  // Name is required
  const name = typeof raw.name === 'string' ? raw.name : DEFAULT_META.name;

  const meta: MetaFile = { name };

  // Optional string fields
  if (typeof raw.description === 'string') {
    meta.description = raw.description;
  }
  if (typeof raw.version === 'string') {
    meta.version = raw.version;
  }
  if (typeof raw.author === 'string') {
    meta.author = raw.author;
  }

  // Tags array
  if (Array.isArray(raw.tags)) {
    meta.tags = raw.tags.filter((t): t is string => typeof t === 'string');
  }

  // Model configuration
  if (raw.model && typeof raw.model === 'object') {
    meta.model = parseModelConfig(raw.model as Record<string, unknown>);
  }

  return meta;
}

/**
 * Parse and validate model configuration
 */
function parseModelConfig(obj: Record<string, unknown>): ModelConfig {
  const config: ModelConfig = {};

  if (typeof obj.provider === 'string') {
    config.provider = obj.provider;
  }
  if (typeof obj.model === 'string') {
    config.model = obj.model;
  }
  if (typeof obj.temperature === 'number') {
    config.temperature = Math.max(0, Math.min(2, obj.temperature));
  }
  if (typeof obj.maxTokens === 'number') {
    config.maxTokens = Math.max(1, Math.floor(obj.maxTokens));
  }

  return config;
}

// =============================================================================
// SERIALIZATION
// =============================================================================

/**
 * Serialize a MetaFile to YAML string
 *
 * @param meta - MetaFile object to serialize
 * @returns YAML string representation
 *
 * @example
 * ```typescript
 * const yaml = serializeMeta({
 *   name: 'My Prompt',
 *   version: '1.0.0',
 *   model: { provider: 'openai', model: 'gpt-4o' }
 * });
 * // name: My Prompt
 * // version: 1.0.0
 * // model:
 * //   provider: openai
 * //   model: gpt-4o
 * ```
 */
export function serializeMeta(meta: MetaFile): string {
  // Build clean object for serialization (omit undefined)
  const obj: Record<string, unknown> = {
    name: meta.name,
  };

  if (meta.description) {
    obj.description = meta.description;
  }
  if (meta.version) {
    obj.version = meta.version;
  }
  if (meta.author) {
    obj.author = meta.author;
  }
  if (meta.model) {
    obj.model = serializeModelConfig(meta.model);
  }
  if (meta.tags && meta.tags.length > 0) {
    obj.tags = meta.tags;
  }

  return YAML.stringify(obj, {
    indent: 2,
    lineWidth: 80,
  });
}

/**
 * Serialize model configuration (omit undefined values)
 */
function serializeModelConfig(config: ModelConfig): Record<string, unknown> {
  const obj: Record<string, unknown> = {};

  if (config.provider) {
    obj.provider = config.provider;
  }
  if (config.model) {
    obj.model = config.model;
  }
  if (config.temperature !== undefined) {
    obj.temperature = config.temperature;
  }
  if (config.maxTokens !== undefined) {
    obj.maxTokens = config.maxTokens;
  }

  return obj;
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Merge partial meta updates into existing meta
 *
 * @param base - Base meta configuration
 * @param updates - Partial updates to apply
 * @returns Merged meta configuration
 */
export function mergeMeta(base: MetaFile, updates: Partial<MetaFile>): MetaFile {
  const merged: MetaFile = { ...base };

  if (updates.name !== undefined) {
    merged.name = updates.name;
  }
  if (updates.description !== undefined) {
    merged.description = updates.description;
  }
  if (updates.version !== undefined) {
    merged.version = updates.version;
  }
  if (updates.author !== undefined) {
    merged.author = updates.author;
  }
  if (updates.tags !== undefined) {
    merged.tags = updates.tags;
  }
  if (updates.model !== undefined) {
    merged.model = { ...base.model, ...updates.model };
  }

  return merged;
}

/**
 * Create default meta.yaml content
 *
 * @param name - Project name
 * @returns YAML string with default configuration
 */
export function createDefaultMetaYaml(name: string): string {
  return serializeMeta({
    ...DEFAULT_META,
    name,
  });
}
