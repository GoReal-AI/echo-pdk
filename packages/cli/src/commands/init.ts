/**
 * @fileoverview Init Command - Initialize an Echo PDK workspace
 *
 * Usage:
 *   echopdk init
 *   echopdk init --name my-prompts --no-plp
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { createInterface } from 'readline';
import chalk from 'chalk';

// =============================================================================
// TYPES
// =============================================================================

interface InitOptions {
  name?: string;
  yes?: boolean;
}

interface WorkspaceConfig {
  name: string;
  version: string;
  ai?: {
    provider: string;
    model: string;
    apiKey?: string;
  };
  plp?: {
    server: string;
    auth: {
      type: 'token' | 'api_key' | 'none';
      token?: string;
    };
  };
  deploy?: {
    environments: string[];
  };
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
 * Init command handler.
 */
export async function initCommand(options: InitOptions): Promise<void> {
  console.log(chalk.bold('\nEcho PDK Workspace Setup\n'));

  const config: WorkspaceConfig = {
    name: '',
    version: '1.0.0',
  };

  if (options.yes) {
    // Non-interactive mode
    config.name = options.name || 'my-prompts';
  } else {
    const prompt = createPrompt();

    try {
      // Workspace name
      config.name = await prompt.ask('Workspace name', options.name || 'my-prompts');

      // AI provider
      const useAi = await prompt.confirm('Configure an AI provider?', true);
      if (useAi) {
        const provider = await prompt.ask(
          'Provider (openai/anthropic/other)',
          'openai'
        );
        const model = await prompt.ask(
          'Default model',
          provider === 'anthropic' ? 'claude-sonnet-4-5-20250929' : 'gpt-4o'
        );
        const apiKeyInput = await prompt.ask(
          'API key (paste key, or press Enter to use env var)',
        );

        const envVarName = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
        config.ai = {
          provider,
          model,
          apiKey: apiKeyInput || `\${${envVarName}}`,
        };

        if (!apiKeyInput) {
          console.log(chalk.dim(`  Will use $${envVarName} environment variable at runtime.`));
        } else {
          console.log(chalk.dim('  Tip: Add echo.workspace.yaml to .gitignore to keep your key safe.'));
        }
      }

      // PLP connection
      const usePlp = await prompt.confirm('Connect to a PLP server?', false);
      if (usePlp) {
        const server = await prompt.ask('PLP server URL', 'https://api.echostash.com');
        const authType = await prompt.ask(
          'Authentication (token/api_key/none)',
          'token'
        ) as 'token' | 'api_key' | 'none';

        config.plp = {
          server,
          auth: { type: authType },
        };

        if (authType === 'token') {
          config.plp.auth.token = '${ECHO_PLP_TOKEN}';
        }
      }

      // Deploy environments
      const useDeploy = await prompt.confirm('Define deployment environments?', false);
      if (useDeploy) {
        const envs = await prompt.ask('Environments (comma-separated)', 'staging, production');
        config.deploy = {
          environments: envs.split(',').map((e) => e.trim()).filter(Boolean),
        };
      }
    } finally {
      prompt.close();
    }
  }

  // Generate workspace file
  const workDir = resolve(process.cwd(), config.name);

  await mkdir(workDir, { recursive: true });

  const yamlContent = generateWorkspaceYaml(config);
  await writeFile(join(workDir, 'echo.workspace.yaml'), yamlContent, 'utf-8');

  console.log(chalk.green(`\n✓ Workspace initialized at ./${config.name}`));
  console.log(`  ${chalk.dim('echo.workspace.yaml')} created`);
  console.log(`\n  Next steps:`);
  console.log(`    cd ${config.name}`);
  console.log(`    echopdk new my-first-prompt`);
  console.log('');
}

// =============================================================================
// YAML GENERATION
// =============================================================================

function generateWorkspaceYaml(config: WorkspaceConfig): string {
  const lines: string[] = [];

  lines.push(`name: ${config.name}`);
  lines.push(`version: ${config.version}`);

  if (config.ai) {
    lines.push('');
    lines.push('ai:');
    lines.push(`  provider: ${config.ai.provider}`);
    lines.push(`  model: ${config.ai.model}`);
    if (config.ai.apiKey) {
      lines.push(`  apiKey: ${config.ai.apiKey}`);
    }
  }

  if (config.plp) {
    lines.push('');
    lines.push('plp:');
    lines.push(`  server: ${config.plp.server}`);
    lines.push('  auth:');
    lines.push(`    type: ${config.plp.auth.type}`);
    if (config.plp.auth.token) {
      lines.push(`    token: ${config.plp.auth.token}`);
    }
  }

  if (config.deploy) {
    lines.push('');
    lines.push('deploy:');
    lines.push('  environments:');
    for (const env of config.deploy.environments) {
      lines.push(`    - ${env}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
