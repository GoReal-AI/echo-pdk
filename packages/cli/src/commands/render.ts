/**
 * @fileoverview Render Command - Render an Echo template
 *
 * Usage:
 *   echo-pdk render template.echo --context '{"name": "Alice"}'
 *   echo-pdk render template.echo --context-file context.json
 *   echo-pdk render template.echo --context-file context.json --output result.txt
 */

import { readFile, writeFile } from 'fs/promises';
import { createEcho } from '@echo-pdk/core';
import chalk from 'chalk';
import ora from 'ora';

// =============================================================================
// TYPES
// =============================================================================

interface RenderOptions {
  context?: string;
  contextFile?: string;
  output?: string;
  strict?: boolean;
  trim?: boolean;
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

/**
 * Render command handler.
 */
export async function renderCommand(
  templatePath: string,
  options: RenderOptions
): Promise<void> {
  const spinner = ora('Rendering template...').start();

  try {
    // 1. Load template
    const template = await loadTemplate(templatePath);

    // 2. Load context
    const context = await loadContext(options);

    // 3. Create Echo instance
    const echo = createEcho({
      strict: options.strict,
    });

    // 4. Render
    spinner.text = 'Rendering...';
    const result = await echo.render(template, context);

    // 5. Apply post-processing
    let output = result;
    if (options.trim) {
      output = output.trim();
    }

    spinner.succeed('Template rendered successfully');

    // 6. Output result
    if (options.output) {
      await writeFile(options.output, output, 'utf-8');
      console.log(chalk.green(`Output written to: ${options.output}`));
    } else {
      console.log('\n' + chalk.bold('Output:'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(output);
      console.log(chalk.gray('─'.repeat(40)));
    }
  } catch (error) {
    spinner.fail('Render failed');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Load template from file.
 */
async function loadTemplate(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to load template: ${path}`);
  }
}

/**
 * Load context from options.
 */
async function loadContext(options: RenderOptions): Promise<Record<string, unknown>> {
  // From --context JSON string
  if (options.context) {
    try {
      return JSON.parse(options.context) as Record<string, unknown>;
    } catch {
      throw new Error('Invalid JSON in --context option');
    }
  }

  // From --context-file
  if (options.contextFile) {
    try {
      const content = await readFile(options.contextFile, 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      throw new Error(`Failed to load context file: ${options.contextFile}`);
    }
  }

  // No context provided
  return {};
}

// =============================================================================
// IMPLEMENTATION NOTES
// =============================================================================

/*
NEXT STEPS TO IMPLEMENT:

1. STREAMING OUTPUT
   For large templates, stream the output instead of buffering.

2. ENVIRONMENT VARIABLES
   Support reading context from environment:
   --env prefix=MY_VAR_

3. MULTIPLE TEMPLATES
   Support glob patterns for batch rendering:
   echo-pdk render "templates/*.echo" --context-file context.json --output-dir dist/

4. STDIN INPUT
   Support reading template from stdin:
   cat template.echo | echo-pdk render - --context '{"name": "Alice"}'

5. PROGRESS REPORTING
   For AI judge conditions, show progress:
   "Evaluating AI conditions... (3/5)"
*/
