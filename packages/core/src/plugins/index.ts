/**
 * @fileoverview Plugin System - Load and manage Echo plugins
 *
 * This module handles loading and registering plugins for Echo.
 * Plugins can add custom operators, validators, and transformations.
 *
 * IMPLEMENTATION GUIDE:
 *
 * 1. PLUGIN LOADING
 *    - Load from npm packages: @goreal-ai/echo-pdk-validators
 *    - Load from local paths: ./plugins/my-plugin.ts
 *    - Validate plugin structure
 *
 * 2. OPERATOR REGISTRATION
 *    - Merge plugin operators with built-ins
 *    - Handle conflicts (plugin can override built-in)
 *
 * 3. LIFECYCLE HOOKS
 *    - onLoad: Called when plugin is loaded
 *    - Future: onRender, onValidate, etc.
 */

import type { EchoPlugin, OperatorDefinition } from '../types.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Plugin registry managing all loaded plugins.
 */
export interface PluginRegistry {
  /** All loaded plugins */
  plugins: EchoPlugin[];
  /** Merged operator definitions from all plugins */
  operators: Map<string, OperatorDefinition>;
}

// =============================================================================
// PLUGIN REGISTRY
// =============================================================================

/**
 * Create a new plugin registry.
 */
export function createPluginRegistry(): PluginRegistry {
  return {
    plugins: [],
    operators: new Map(),
  };
}

/**
 * Load a plugin into the registry.
 *
 * @param registry - The plugin registry
 * @param plugin - The plugin to load
 */
export async function loadPlugin(
  registry: PluginRegistry,
  plugin: EchoPlugin
): Promise<void> {
  // Validate plugin structure
  validatePlugin(plugin);

  // Register operators
  if (plugin.operators) {
    for (const [name, definition] of Object.entries(plugin.operators)) {
      registry.operators.set(name, definition);
    }
  }

  // Call onLoad hook
  if (plugin.onLoad) {
    await plugin.onLoad();
  }

  // Add to registry
  registry.plugins.push(plugin);
}

/**
 * Load a plugin from a path (npm package or local file).
 *
 * @param registry - The plugin registry
 * @param path - Path to the plugin
 */
export async function loadPluginFromPath(
  _registry: PluginRegistry,
  path: string
): Promise<void> {
  // TODO: Implement plugin loading from path
  //
  // IMPLEMENTATION:
  //
  // 1. DETERMINE PATH TYPE
  //    - If starts with @, ., or / -> resolve as module path
  //    - Otherwise -> resolve as npm package
  //
  // 2. DYNAMIC IMPORT
  //    const module = await import(resolvedPath);
  //    const plugin = module.default;
  //
  // 3. LOAD PLUGIN
  //    await loadPlugin(registry, plugin);

  throw new Error(`Plugin loading not implemented: ${path}`);
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate a plugin structure.
 *
 * @param plugin - The plugin to validate
 * @throws If the plugin is invalid
 */
export function validatePlugin(plugin: unknown): asserts plugin is EchoPlugin {
  if (!plugin || typeof plugin !== 'object') {
    throw new Error('Plugin must be an object');
  }

  const p = plugin as Record<string, unknown>;

  if (typeof p.name !== 'string' || p.name.length === 0) {
    throw new Error('Plugin must have a name');
  }

  if (typeof p.version !== 'string') {
    throw new Error('Plugin must have a version');
  }

  if (p.operators !== undefined) {
    if (typeof p.operators !== 'object') {
      throw new Error('Plugin operators must be an object');
    }

    // Validate each operator
    for (const [name, def] of Object.entries(p.operators as Record<string, unknown>)) {
      validateOperatorDefinition(name, def);
    }
  }
}

/**
 * Validate an operator definition.
 */
function validateOperatorDefinition(name: string, def: unknown): void {
  if (!def || typeof def !== 'object') {
    throw new Error(`Operator ${name} must be an object`);
  }

  const d = def as Record<string, unknown>;

  if (!['comparison', 'unary', 'ai'].includes(d.type as string)) {
    throw new Error(
      `Operator ${name} must have type: comparison, unary, or ai`
    );
  }

  if (typeof d.handler !== 'function') {
    throw new Error(`Operator ${name} must have a handler function`);
  }

  if (typeof d.description !== 'string') {
    throw new Error(`Operator ${name} must have a description`);
  }
}

// =============================================================================
// PLUGIN CREATION HELPER
// =============================================================================

/**
 * Helper function for creating plugins with type safety.
 * Re-exported from main index.ts
 */
export function definePlugin(plugin: EchoPlugin): EchoPlugin {
  // Validate at definition time
  validatePlugin(plugin);
  return plugin;
}

// =============================================================================
// IMPLEMENTATION NOTES
// =============================================================================

/*
NEXT STEPS TO IMPLEMENT:

1. PATH RESOLUTION
   - Handle npm packages (@goreal-ai/echo-pdk-foo)
   - Handle relative paths (./foo)
   - Handle absolute paths (/path/to/foo)

2. HOT RELOADING (FUTURE)
   For development mode, support reloading plugins without restart.

3. PLUGIN DISCOVERY
   - Scan node_modules for echo-pdk plugins
   - Read from echo.config.yaml

4. LIFECYCLE HOOKS
   Add more hooks:
   - onValidate: Custom validation rules
   - onBeforeRender: Transform AST before render
   - onAfterRender: Transform output after render

5. TESTS
   Create plugins.test.ts with tests for:
   - Plugin validation
   - Operator registration
   - Path loading
   - Lifecycle hooks
*/
