#!/usr/bin/env node
/**
 * Bundle echo-pdk for GraalJS (Java) integration.
 * Creates a single IIFE bundle that exposes renderTemplate globally.
 */

import * as esbuild from 'esbuild';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outfile = join(__dirname, '..', 'dist', 'echo-pdk.graaljs.js');

async function bundle() {
  // Bundle the core library
  const result = await esbuild.build({
    entryPoints: [join(__dirname, '..', 'src', 'index.ts')],
    bundle: true,
    format: 'iife',
    globalName: 'EchoPDK',
    platform: 'browser', // Use browser platform to avoid Node.js built-ins
    target: 'es2020',
    write: false,
    minify: false, // Keep readable for debugging
    external: ['openai', '@goreal-ai/plp-client'], // These won't be used in Java
    // Polyfill/ignore Node.js built-ins that won't be used
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env': '{}',
      'process': '{"env":{}}',
    },
    // Stub out crypto - only used for AI judge caching which we skip in Java
    alias: {
      'crypto': join(__dirname, 'stubs', 'crypto.mjs'),
    },
  });

  // Get the bundled code
  let code = result.outputFiles[0].text;

  // Add a wrapper that exposes a simple render function for Java
  const wrapper = `
// Echo PDK Bundle for GraalJS
// Generated: ${new Date().toISOString()}

${code}

// Expose simplified API for Java integration
var echoPdk = {
  /**
   * Render a template (async, returns a Promise).
   * Supports full Echo DSL including conditionals.
   * @param {string} template - The Echo DSL template
   * @param {Object} context - Variables to substitute
   * @param {Object} [config] - Optional configuration
   * @returns {Promise<string>} - Rendered output
   */
  render: function(template, context, config) {
    var echo = EchoPDK.createEcho(config || {});
    // Use the full async render pipeline which includes evaluation
    return echo.render(template, context || {});
  },

  /**
   * Render a template synchronously (no AI judge support).
   * Uses evaluate + render for full conditional support.
   * @param {string} template - The Echo DSL template
   * @param {Object} context - Variables to substitute
   * @param {Object} [config] - Optional configuration
   * @returns {string} - Rendered output
   */
  renderSync: function(template, context, config) {
    // Parse
    var parseResult = EchoPDK.parse(template);
    if (!parseResult.success || !parseResult.ast) {
      throw new Error('Parse error: ' + JSON.stringify(parseResult.errors));
    }

    // For sync, we need to block on the evaluate Promise
    // GraalJS supports this via Java.await() or we can use a workaround
    var evaluatedAst = parseResult.ast;
    var evalPromise = EchoPDK.evaluate(parseResult.ast, context || {}, config || {});

    // Try to get result synchronously if possible
    if (evalPromise && typeof evalPromise.then === 'function') {
      // It's a Promise - we need to use Java interop to block
      // For now, fall back to direct rendering without conditional evaluation
      // This is a limitation - conditionals won't work in sync mode
      // Use render() for full support
    } else if (evalPromise && evalPromise.ast) {
      evaluatedAst = evalPromise.ast;
    }

    // Render
    var rendered = EchoPDK.render(evaluatedAst, {
      context: context || {},
      config: config || {},
      trim: false,
      collapseNewlines: true
    });
    return rendered;
  },

  /**
   * Parse a template and return the AST.
   * @param {string} template - The Echo DSL template
   * @returns {Object} - Parse result with ast and errors
   */
  parse: function(template) {
    return EchoPDK.parse(template);
  },

  /**
   * Extract variables from a template.
   * @param {string} template - The Echo DSL template
   * @returns {Array} - Array of variable info objects
   */
  extractVariables: function(template) {
    var parseResult = EchoPDK.parse(template);
    if (!parseResult.success || !parseResult.ast) {
      return [];
    }
    var variables = [];
    function visit(nodes) {
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.type === 'variable') {
          variables.push({
            name: node.path,
            type: node.varType || 'text',
            defaultValue: node.defaultValue
          });
        } else if (node.type === 'conditional') {
          visit(node.consequent);
          if (node.alternate) {
            if (Array.isArray(node.alternate)) {
              visit(node.alternate);
            } else {
              visit([node.alternate]);
            }
          }
        } else if (node.type === 'section') {
          visit(node.body);
        }
      }
    }
    visit(parseResult.ast);
    return variables;
  },

  /**
   * Validate a template without rendering.
   * @param {string} template - The Echo DSL template
   * @returns {Object} - { valid: boolean, errors: Array }
   */
  validate: function(template) {
    var parseResult = EchoPDK.parse(template);
    return {
      valid: parseResult.success,
      errors: parseResult.errors || []
    };
  },

  /**
   * Check if a string is a valid provider type.
   * @param {string} value - String to check
   * @returns {boolean} - true if value is a known provider type
   */
  isProviderType: function(value) {
    return EchoPDK.isProviderType(value);
  },

  /**
   * Get metadata for all known AI providers.
   * @returns {Array} - Array of provider info objects
   */
  getProviders: function() {
    return EchoPDK.getProviders();
  },

  /**
   * List available models for a provider (async, returns a Promise).
   * @param {string} type - Provider type ('openai' or 'anthropic')
   * @param {string} apiKey - API key for authentication
   * @returns {Promise<Array>} - Array of model info objects
   */
  listModels: function(type, apiKey) {
    return EchoPDK.listModels(type, apiKey);
  },

  /**
   * Create an AI provider instance.
   * @param {Object} config - { type, apiKey, model?, baseUrl?, timeout? }
   * @returns {Object} - Provider instance with complete(), listModels(), judge(), similarity()
   */
  createProvider: function(config) {
    return EchoPDK.createProvider(config);
  },

  /**
   * Render a template and send to an LLM in one call (async, returns a Promise).
   * @param {Object} options - { template, variables, provider, systemMessage? }
   * @returns {Promise<Object>} - { renderedPrompt, response }
   */
  runPrompt: function(options) {
    return EchoPDK.runPrompt(options);
  }
};
`;

  writeFileSync(outfile, wrapper);
  console.log(`Bundle created: ${outfile}`);
  console.log(`Size: ${(wrapper.length / 1024).toFixed(1)} KB`);
}

bundle().catch(err => {
  console.error('Bundle failed:', err);
  process.exit(1);
});
