/**
 * @fileoverview Validate Command - Validate Echo template syntax
 *
 * Usage:
 *   echopdk validate template.echo
 *   echopdk validate template.echo --strict
 */

import { readFile } from 'fs/promises';
import { createEcho } from '@echo-pdk/core';
import chalk from 'chalk';

// =============================================================================
// TYPES
// =============================================================================

interface ValidateOptions {
  strict?: boolean;
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

/**
 * Validate command handler.
 */
export async function validateCommand(
  templatePath: string,
  options: ValidateOptions
): Promise<void> {
  try {
    // 1. Load template
    const template = await loadTemplate(templatePath);

    // 2. Create Echo instance
    const echo = createEcho();

    // 3. Validate
    const result = echo.validate(template);

    // 4. Report results
    if (result.valid) {
      console.log(chalk.green('✓') + ` ${templatePath} is valid`);

      // Show warnings if any
      if (result.warnings.length > 0) {
        console.log('\n' + chalk.yellow('Warnings:'));
        for (const warning of result.warnings) {
          printDiagnostic(warning, 'warning', template);
        }

        if (options.strict) {
          console.log(
            chalk.yellow('\n⚠ Warnings treated as errors in strict mode')
          );
          process.exit(1);
        }
      }
    } else {
      console.log(chalk.red('✗') + ` ${templatePath} has errors`);
      console.log('\n' + chalk.red('Errors:'));

      for (const error of result.errors) {
        printDiagnostic(error, 'error', template);
      }

      if (result.warnings.length > 0) {
        console.log('\n' + chalk.yellow('Warnings:'));
        for (const warning of result.warnings) {
          printDiagnostic(warning, 'warning', template);
        }
      }

      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Error: ') + (error as Error).message);
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
 * Print a diagnostic (error or warning) with source context.
 */
function printDiagnostic(
  diagnostic: { code: string; message: string; location?: { startLine: number; startColumn: number } },
  type: 'error' | 'warning',
  source: string
): void {
  const color = type === 'error' ? chalk.red : chalk.yellow;
  const symbol = type === 'error' ? '✗' : '⚠';

  console.log(`\n${color(symbol)} [${diagnostic.code}] ${diagnostic.message}`);

  if (diagnostic.location) {
    const { startLine, startColumn } = diagnostic.location;
    const lines = source.split('\n');
    const line = lines[startLine - 1];

    if (line) {
      console.log(chalk.gray(`  ${startLine} │ `) + line);
      console.log(
        chalk.gray(`    │ `) + ' '.repeat(startColumn - 1) + color('^')
      );
    }
  }
}

// =============================================================================
// IMPLEMENTATION NOTES
// =============================================================================

/*
NEXT STEPS TO IMPLEMENT:

1. GLOB PATTERNS
   Support validating multiple files:
   echopdk validate "templates/*.echo"

2. JSON/SARIF OUTPUT
   For CI integration:
   echopdk validate template.echo --format json
   echopdk validate template.echo --format sarif

3. FIX SUGGESTIONS
   Some errors might be auto-fixable:
   echopdk validate template.echo --fix

4. WATCH MODE
   Re-validate on file changes:
   echopdk validate template.echo --watch

5. CUSTOM RULES
   Load validation rules from config:
   echopdk validate template.echo --config echo.config.yaml
*/
