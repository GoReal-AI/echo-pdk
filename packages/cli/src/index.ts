#!/usr/bin/env node
/**
 * @fileoverview Echo CLI - Command-line interface
 *
 * This is the main entry point for the Echo CLI.
 * It uses Commander.js to define commands and options.
 *
 * COMMANDS:
 * - render: Render a template with context
 * - validate: Validate template syntax
 * - debug: Show AST and evaluation trace
 * - watch: Watch mode for development
 */

import { Command } from 'commander';
import { renderCommand } from './commands/render.js';
import { validateCommand } from './commands/validate.js';
import { initCommand } from './commands/init.js';
import { newCommand } from './commands/new.js';
import { editCommand } from './commands/edit.js';
import { evalCommand } from './commands/eval.js';
import { runCommand } from './commands/run.js';

// =============================================================================
// CLI SETUP
// =============================================================================

const program = new Command();

program
  .name('echopdk')
  .description('Echo PDK - Dynamic prompt templating DSL')
  .version('0.1.0')
  .option('--api-key <key>', 'AI provider API key (or set OPENAI_API_KEY env var)');

// =============================================================================
// COMMANDS
// =============================================================================

// Render command
program
  .command('render <template>')
  .description('Render an Echo template with context')
  .option('-c, --context <json>', 'Context as JSON string')
  .option('-f, --context-file <path>', 'Path to context JSON file')
  .option('-d, --context-dir <path>', 'Directory for #context() file resolution')
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

// Init command
program
  .command('init')
  .description('Initialize an Echo PDK workspace')
  .option('-n, --name <name>', 'Workspace name')
  .option('-y, --yes', 'Non-interactive mode with defaults', false)
  .action(initCommand);

// New command
program
  .command('new <name>')
  .description('Scaffold a new prompt project')
  .option('-m, --model <model>', 'Default model (e.g., gpt-4o)')
  .option('-y, --yes', 'Non-interactive mode with defaults', false)
  .action(newCommand);

// Edit command
program
  .command('edit <name>')
  .description('Open a prompt file in $EDITOR')
  .option('--meta', 'Open meta.yaml instead of prompt.pdk')
  .option('--eval <test>', 'Open a specific .eval file')
  .action(editCommand);

// Eval command
program
  .command('eval [file]')
  .description('Run evaluation suites')
  .option('--record', 'Record LLM responses as golden in .dset files')
  .option('--filter <pattern>', 'Filter tests by name pattern')
  .option('--reporter <type>', 'Output format: console, json, junit', 'console')
  .option('-m, --model <model>', 'Override model for LLM assertions')
  .action((file: string | undefined, options: Record<string, unknown>, cmd: Command) => {
    const globalOpts = cmd.optsWithGlobals();
    return evalCommand(file, { ...options, apiKey: globalOpts.apiKey } as Parameters<typeof evalCommand>[1]);
  });

// Run command — execute prompt against a real LLM
program
  .command('run <prompt>')
  .description('Run a prompt against the model configured in meta.yaml')
  .option('-c, --context <json>', 'Context variables as JSON string')
  .option('-f, --context-file <path>', 'Path to context JSON file')
  .option('-m, --model <model>', 'Override model (e.g., gpt-4o-mini)')
  .option('--show-rendered', 'Show the rendered prompt before sending to LLM')
  .action((name: string, options: Record<string, unknown>, cmd: Command) => {
    const globalOpts = cmd.optsWithGlobals();
    return runCommand(name, { ...options, apiKey: globalOpts.apiKey } as Parameters<typeof runCommand>[1]);
  });

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
