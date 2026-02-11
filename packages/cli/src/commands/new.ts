/**
 * @fileoverview New Command - Scaffold a new prompt project
 *
 * Usage:
 *   echopdk new movie-recommender
 *   echopdk new movie-recommender --model gpt-4o
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { createInterface } from 'readline';
import chalk from 'chalk';

// =============================================================================
// TYPES
// =============================================================================

interface NewOptions {
  model?: string;
  yes?: boolean;
}

interface PromptVariable {
  name: string;
  type: 'text' | 'number' | 'boolean';
}

interface ScaffoldConfig {
  name: string;
  description: string;
  model: string;
  variables: PromptVariable[];
}

// =============================================================================
// INTERACTIVE PROMPTS
// =============================================================================

function createPrompt(): {
  ask: (question: string, defaultValue?: string) => Promise<string>;
  confirm: (question: string, defaultValue?: boolean) => Promise<boolean>;
  close: () => void;
} {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return {
    ask: (question: string, defaultValue?: string): Promise<string> => {
      const suffix = defaultValue ? ` (${defaultValue})` : '';
      return new Promise((resolve) => {
        rl.question(`${chalk.cyan('?')} ${question}${suffix}: `, (answer) => {
          resolve(answer.trim() || defaultValue || '');
        });
      });
    },
    confirm: (question: string, defaultValue = true): Promise<boolean> => {
      const hint = defaultValue ? 'Y/n' : 'y/N';
      return new Promise((resolve) => {
        rl.question(`${chalk.cyan('?')} ${question} (${hint}): `, (answer) => {
          if (!answer.trim()) resolve(defaultValue);
          else resolve(answer.trim().toLowerCase().startsWith('y'));
        });
      });
    },
    close: () => rl.close(),
  };
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

/**
 * New command handler.
 */
export async function newCommand(
  name: string,
  options: NewOptions
): Promise<void> {
  console.log(chalk.bold(`\nScaffolding prompt: ${name}\n`));

  const config: ScaffoldConfig = {
    name,
    description: '',
    model: options.model || 'gpt-4o',
    variables: [],
  };

  if (!options.yes) {
    const prompt = createPrompt();

    try {
      config.description = await prompt.ask('What does this prompt do?', '');
      config.model = await prompt.ask('Model', config.model);

      // Variable collection loop
      let addMore = await prompt.confirm('Define variables?', true);
      while (addMore) {
        const varName = await prompt.ask('Variable name');
        if (!varName) break;

        const varType = await prompt.ask(
          'Variable type (text/number/boolean)',
          'text'
        ) as 'text' | 'number' | 'boolean';

        config.variables.push({ name: varName, type: varType });
        addMore = await prompt.confirm('Add another variable?', true);
      }
    } finally {
      prompt.close();
    }
  }

  // Create directory structure
  const promptDir = resolve(process.cwd(), name);
  await mkdir(join(promptDir, 'eval', 'tests'), { recursive: true });
  await mkdir(join(promptDir, 'eval', 'datasets'), { recursive: true });

  // Generate files
  await writeFile(
    join(promptDir, 'prompt.pdk'),
    generatePromptPdk(config),
    'utf-8'
  );

  await writeFile(
    join(promptDir, 'meta.yaml'),
    generateMetaYaml(config),
    'utf-8'
  );

  console.log(chalk.green(`\n✓ Created ${name}/`));
  console.log(`  ${chalk.dim('prompt.pdk')}     (template with variables)`);
  console.log(`  ${chalk.dim('meta.yaml')}      (model config)`);
  console.log(`  ${chalk.dim('eval/tests/')}    (ready for .eval files)`);
  console.log(`  ${chalk.dim('eval/datasets/')} (ready for .dset files)`);
  console.log(`\n  Next steps:`);
  console.log(`    echopdk edit ${name}`);
  console.log(`    echopdk render ${name}/prompt.pdk -c '{"${config.variables[0]?.name || 'input'}": "test"}'`);
  console.log('');
}

// =============================================================================
// FILE GENERATION
// =============================================================================

function generatePromptPdk(config: ScaffoldConfig): string {
  const lines: string[] = [];

  if (config.description) {
    lines.push(`You are a ${config.description}.`);
  } else {
    lines.push(`You are a helpful assistant.`);
  }

  lines.push('');

  if (config.variables.length > 0) {
    for (const v of config.variables) {
      if (v.type === 'text') {
        lines.push(`{{${v.name}}}`);
      } else {
        lines.push(`{{${v.name}:${v.type}}}`);
      }
    }
  } else {
    lines.push('{{user_input}}');
  }

  lines.push('');
  return lines.join('\n');
}

function generateMetaYaml(config: ScaffoldConfig): string {
  const lines: string[] = [];

  lines.push(`name: ${config.name}`);
  if (config.description) {
    lines.push(`description: "${config.description}"`);
  }
  lines.push('version: "1.0.0"');
  lines.push('model:');
  lines.push('  provider: openai');
  lines.push(`  model: ${config.model}`);
  lines.push('  temperature: 0.7');

  if (config.variables.length > 0) {
    lines.push('tags:');
    lines.push(`  - ${config.name}`);
  }

  lines.push('');
  return lines.join('\n');
}
