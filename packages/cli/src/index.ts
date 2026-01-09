#!/usr/bin/env node
/**
 * @fileoverview Echo PDK CLI - Command-line interface
 *
 * This is the main entry point for the echo-pdk CLI.
 * It uses Commander.js to define commands and options.
 *
 * COMMANDS:
 * - render: Render a template with context
 * - validate: Validate template syntax
 * - debug: Show AST and evaluation trace
 * - init: Initialize a new Echo project
 * - watch: Watch mode for development
 */

import { Command } from 'commander';
import { renderCommand } from './commands/render.js';
import { validateCommand } from './commands/validate.js';

// =============================================================================
// CLI SETUP
// =============================================================================

const program = new Command();

program
  .name('echo-pdk')
  .description('Echo Prompt Development Kit - Dynamic prompt templating')
  .version('0.1.0');

// =============================================================================
// COMMANDS
// =============================================================================

// Render command
program
  .command('render <template>')
  .description('Render an Echo template with context')
  .option('-c, --context <json>', 'Context as JSON string')
  .option('-f, --context-file <path>', 'Path to context JSON file')
  .option('-o, --output <path>', 'Output file path (stdout if not specified)')
  .option('--strict', 'Fail on any error', false)
  .option('--trim', 'Trim whitespace from output', false)
  .action(renderCommand);

// Validate command
program
  .command('validate <template>')
  .description('Validate an Echo template syntax')
  .option('--strict', 'Treat warnings as errors', false)
  .action(validateCommand);

// Debug command
program
  .command('debug <template>')
  .description('Show AST and evaluation trace for a template')
  .option('-c, --context <json>', 'Context as JSON string')
  .option('-f, --context-file <path>', 'Path to context JSON file')
  .option('--ast', 'Show only the AST')
  .option('--tokens', 'Show only the tokens')
  .action(async (template: string, options: Record<string, unknown>) => {
    // TODO: Implement debug command
    console.log('Debug command not yet implemented');
    console.log('Template:', template);
    console.log('Options:', options);
  });

// Init command
program
  .command('init [directory]')
  .description('Initialize a new Echo project')
  .option('--template <name>', 'Project template to use', 'default')
  .action(async (directory: string = '.', options: Record<string, unknown>) => {
    // TODO: Implement init command
    console.log('Init command not yet implemented');
    console.log('Directory:', directory);
    console.log('Options:', options);
  });

// Watch command
program
  .command('watch <template>')
  .description('Watch mode - re-render on file changes')
  .option('-c, --context <json>', 'Context as JSON string')
  .option('-f, --context-file <path>', 'Path to context JSON file')
  .action(async (template: string, options: Record<string, unknown>) => {
    // TODO: Implement watch command
    console.log('Watch command not yet implemented');
    console.log('Template:', template);
    console.log('Options:', options);
  });

// =============================================================================
// RUN
// =============================================================================

program.parse();
