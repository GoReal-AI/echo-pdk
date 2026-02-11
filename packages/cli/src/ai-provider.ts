/**
 * @fileoverview Shared AI provider resolution for CLI commands
 *
 * Resolves the AI provider configuration from multiple sources:
 *   1. CLI --api-key flag (highest priority)
 *   2. Environment variable OPENAI_API_KEY / ECHO_API_KEY
 *   3. echo.workspace.yaml ai section
 *   4. meta.yaml model config (for model/temperature/maxTokens)
 *
 * LLM calls are delegated to @goreal-ai/echo-pdk's unified provider system.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { isProviderType } from '@goreal-ai/echo-pdk';
import type { ModelConfig, ProviderType } from '@goreal-ai/echo-pdk';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Resolved AI provider configuration ready for use.
 */
export interface AIProviderConfig {
  /** Provider type */
  type: ProviderType;
  /** API key */
  apiKey: string;
  /** Model identifier */
  model: string;
  /** Temperature (0-2) */
  temperature: number;
  /** Max tokens for response */
  maxTokens?: number;
}

// =============================================================================
// WORKSPACE CONFIG
// =============================================================================

/**
 * AI section from echo.workspace.yaml.
 */
interface WorkspaceAIConfig {
  provider?: string;
  model?: string;
  apiKey?: string;
}

/** Cached workspace config (loaded once per process). */
let cachedWorkspaceAI: WorkspaceAIConfig | null | undefined;

/**
 * Find and parse the ai section from echo.workspace.yaml.
 * Walks up from cwd to find the file.
 */
export function loadWorkspaceAIConfig(): WorkspaceAIConfig | null {
  if (cachedWorkspaceAI !== undefined) return cachedWorkspaceAI;

  const yamlPath = findFileUpward('echo.workspace.yaml', process.cwd());
  if (!yamlPath) {
    cachedWorkspaceAI = null;
    return null;
  }

  try {
    const content = readFileSync(yamlPath, 'utf-8');
    const ai = parseWorkspaceAI(content);
    cachedWorkspaceAI = ai;
    return ai;
  } catch {
    cachedWorkspaceAI = null;
    return null;
  }
}

/**
 * Walk up directory tree to find a file.
 */
function findFileUpward(filename: string, from: string): string | null {
  let dir = resolve(from);
  const root = dirname(dir) === dir ? dir : undefined;

  while (true) {
    const candidate = resolve(dir, filename);
    try {
      readFileSync(candidate, 'utf-8');
      return candidate;
    } catch {
      // Not found here, go up
    }
    const parent = dirname(dir);
    if (parent === dir || parent === root) return null;
    dir = parent;
  }
}

/**
 * Extract the ai section from workspace YAML (simple line-based parser).
 */
function parseWorkspaceAI(content: string): WorkspaceAIConfig | null {
  const lines = content.split('\n');
  const config: WorkspaceAIConfig = {};
  let inAiSection = false;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Detect top-level keys (no indentation)
    if (trimmed.length > 0 && !trimmed.startsWith(' ') && !trimmed.startsWith('#')) {
      inAiSection = trimmed.startsWith('ai:');
      continue;
    }

    if (!inAiSection) continue;

    const match = trimmed.match(/^\s+(provider|model|apiKey):\s*(.+)$/);
    if (match && match[1] && match[2]) {
      config[match[1] as keyof WorkspaceAIConfig] = match[2].trim();
    }
  }

  if (!config.provider && !config.model && !config.apiKey) return null;
  return config;
}

/**
 * Resolve an API key value — if it's an env var reference like ${OPENAI_API_KEY},
 * look it up from the environment.
 */
function resolveKeyValue(value: string): string | undefined {
  const envMatch = value.match(/^\$\{(.+)\}$/);
  if (envMatch && envMatch[1]) {
    return process.env[envMatch[1]] || undefined;
  }
  return value;
}

// =============================================================================
// API KEY RESOLUTION
// =============================================================================

/**
 * Resolve the API key from CLI flag, environment variables, or workspace config.
 *
 * Priority:
 *   1. Explicit --api-key flag
 *   2. OPENAI_API_KEY env var
 *   3. ECHO_API_KEY env var
 *   4. echo.workspace.yaml ai.apiKey
 */
export function resolveApiKey(cliApiKey?: string): string | undefined {
  if (cliApiKey) return cliApiKey;
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (process.env.ECHO_API_KEY) return process.env.ECHO_API_KEY;

  const workspace = loadWorkspaceAIConfig();
  if (workspace?.apiKey) {
    return resolveKeyValue(workspace.apiKey);
  }

  return undefined;
}

// =============================================================================
// PROVIDER RESOLUTION
// =============================================================================

/**
 * Build a full AIProviderConfig from meta.yaml model config + API key.
 *
 * Resolution order for provider/model (highest priority first):
 *   1. CLI overrides (--model)
 *   2. meta.yaml model config (per-prompt)
 *   3. echo.workspace.yaml ai section (workspace-wide)
 *   4. Defaults (openai / gpt-4o)
 *
 * @param apiKey - Resolved API key
 * @param metaModel - Model config from meta.yaml (optional)
 * @param overrides - CLI-level overrides (--model, etc.)
 */
export function resolveProviderConfig(
  apiKey: string,
  metaModel?: ModelConfig,
  overrides?: { model?: string }
): AIProviderConfig {
  const workspace = loadWorkspaceAIConfig();

  const rawType = metaModel?.provider ?? workspace?.provider ?? 'openai';
  if (!isProviderType(rawType)) {
    throw new Error(
      `Unknown AI provider "${rawType}". Supported providers: openai, anthropic.`
    );
  }

  return {
    type: rawType,
    apiKey,
    model: overrides?.model ?? metaModel?.model ?? workspace?.model ?? 'gpt-4o',
    temperature: metaModel?.temperature ?? 0.7,
    maxTokens: metaModel?.maxTokens,
  };
}
