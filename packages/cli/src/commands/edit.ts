/**
 * @fileoverview Edit Command - Open prompt files in $EDITOR
 *
 * Usage:
 *   echopdk edit movie-recommender           # opens prompt.pdk
 *   echopdk edit movie-recommender --meta    # opens meta.yaml
 *   echopdk edit movie-recommender --eval smoke  # opens smoke.eval
 */

import { stat } from 'fs/promises';
import { join, resolve } from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';

// =============================================================================
// TYPES
// =============================================================================

interface EditOptions {
  meta?: boolean;
  eval?: string;
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

/**
 * Edit command handler.
 */
export async function editCommand(
  name: string,
  options: EditOptions
): Promise<void> {
  const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
  const promptDir = resolve(process.cwd(), name);

  // Determine which file to open
  let filePath: string;

  if (options.meta) {
    filePath = join(promptDir, 'meta.yaml');
  } else if (options.eval) {
    filePath = join(promptDir, 'eval', 'tests', `${options.eval}.eval`);
  } else {
    filePath = join(promptDir, 'prompt.pdk');
  }

  // Verify file exists
  try {
    await stat(filePath);
  } catch {
    console.error(chalk.red(`File not found: ${filePath}`));
    console.log(chalk.dim(`\nMake sure the prompt "${name}" exists.`));
    console.log(chalk.dim(`Create it with: echopdk new ${name}`));
    process.exit(1);
  }

  // Open in editor
  console.log(chalk.dim(`Opening ${filePath} in ${editor}...`));

  const child = spawn(editor, [filePath], {
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    if (code === 0) {
      console.log(chalk.green('✓ File saved'));
    } else if (code != null) {
      console.error(chalk.red(`Editor exited with code ${code}`));
    }
  });

  child.on('error', (err) => {
    console.error(chalk.red(`Failed to open editor "${editor}": ${err.message}`));
    console.log(chalk.dim('Set the EDITOR environment variable to your preferred editor.'));
    console.log(chalk.dim('  export EDITOR=code   # VS Code'));
    console.log(chalk.dim('  export EDITOR=vim    # Vim'));
    console.log(chalk.dim('  export EDITOR=nano   # Nano'));
    process.exit(1);
  });
}
