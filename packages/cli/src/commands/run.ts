/**
 * @fileoverview Run Command - Run a prompt against a real LLM
 *
 * Loads prompt.pdk + meta.yaml, renders the template with context,
 * sends to the model configured in meta.yaml, and prints the response.
 *
 * Usage:
 *   echopdk run movie-recommender -c '{"companions":"Family","genre":"Comedy"}'
 *   echopdk run movie-recommender -f context.json
 *   echopdk run movie-recommender -c '...' --model gpt-4o-mini
 *   echopdk run movie-recommender -c '...' --api-key sk-...
 */

import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { createEcho, parseMeta, createProvider } from '@goreal-ai/echo-pdk';
import { createFileContextResolver } from './render.js';
import type { MetaFile, CompletionResponse, MultimodalContent } from '@goreal-ai/echo-pdk';
import chalk from 'chalk';
import ora from 'ora';
import {
  resolveApiKey,
  resolveProviderConfig,
} from '../ai-provider.js';

// =============================================================================
// TYPES
// =============================================================================

interface RunOptions {
  context?: string;
  contextFile?: string;
  contextDir?: string;
  model?: string;
  showRendered?: boolean;
  apiKey?: string;
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

/**
 * Run command handler.
 */
export async function runCommand(
  name: string,
  options: RunOptions
): Promise<void> {
  const promptDir = resolve(process.cwd(), name);

  // 1. Load prompt template
  const templatePath = join(promptDir, 'prompt.pdk');
  let template: string;
  try {
    template = await readFile(templatePath, 'utf-8');
  } catch {
    console.error(chalk.red(`Prompt not found: ${templatePath}`));
    console.log(chalk.dim(`Create it with: echopdk new ${name}`));
    process.exit(1);
  }

  // 2. Load meta.yaml
  const metaPath = join(promptDir, 'meta.yaml');
  let meta: MetaFile | null = null;
  try {
    const metaContent = await readFile(metaPath, 'utf-8');
    meta = parseMeta(metaContent);
  } catch {
    // meta.yaml is optional for run — use defaults
  }

  // 3. Resolve API key
  const apiKey = resolveApiKey(options.apiKey);
  if (!apiKey) {
    console.error(chalk.red('No API key found.'));
    console.log('');
    console.log('Provide an API key via one of:');
    console.log(`  ${chalk.cyan('--api-key sk-...')}             CLI flag`);
    console.log(`  ${chalk.cyan('export OPENAI_API_KEY=sk-...')} Environment variable`);
    console.log(`  ${chalk.cyan('export ECHO_API_KEY=sk-...')}   Environment variable`);
    process.exit(1);
  }

  // 4. Load context
  const context = await loadContext(options);

  // 5. Render the template (multimodal to support images via #context())
  const spinner = ora('Rendering template...').start();
  const contextResolver = options.contextDir
    ? createFileContextResolver(options.contextDir)
    : undefined;
  const echo = createEcho({ strict: false, contextResolver });
  let rendered: MultimodalContent;
  try {
    rendered = await echo.renderMultimodal(template, context);
  } catch (err) {
    spinner.fail('Render failed');
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }

  // 6. Show rendered output if requested
  if (options.showRendered) {
    spinner.stop();
    console.log(chalk.bold('\nRendered prompt:'));
    console.log(chalk.dim('─'.repeat(60)));
    for (const block of rendered) {
      if (block.type === 'text') {
        console.log(chalk.dim(block.text));
      } else {
        console.log(chalk.dim(`[IMAGE: ${block.image_url.url.substring(0, 60)}...]`));
      }
    }
    console.log(chalk.dim('─'.repeat(60)));
    console.log('');
    spinner.start();
  }

  // 7. Build provider config from meta + CLI overrides
  const providerConfig = resolveProviderConfig(apiKey, meta?.model, {
    model: options.model,
  });

  // 8. Send to LLM — use content blocks for multimodal, plain string otherwise
  spinner.text = `Sending to ${providerConfig.model}...`;
  const hasImages = rendered.some((b) => b.type === 'image_url');
  const messageContent = hasImages
    ? rendered
    : rendered.map((b) => (b.type === 'text' ? b.text : '')).join('');

  let result: CompletionResponse;
  try {
    const provider = createProvider({
      type: providerConfig.type,
      apiKey: providerConfig.apiKey,
      model: providerConfig.model,
    });
    result = await provider.complete(
      [{ role: 'user', content: messageContent }],
      {
        model: providerConfig.model,
        temperature: providerConfig.temperature,
        maxTokens: providerConfig.maxTokens,
      }
    );
  } catch (err) {
    spinner.fail('LLM call failed');
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }

  spinner.succeed(`Response from ${result.model} (${result.latencyMs}ms)`);

  // 9. Print response
  console.log(chalk.dim('─'.repeat(60)));
  console.log(result.text);
  console.log(chalk.dim('─'.repeat(60)));

  // 10. Print usage stats
  if (result.tokens) {
    console.log(
      chalk.dim(
        `\nTokens: ${result.tokens.prompt} prompt + ${result.tokens.completion} completion = ${result.tokens.total} total`
      )
    );
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Load context from CLI options.
 */
async function loadContext(options: RunOptions): Promise<Record<string, unknown>> {
  if (options.context) {
    try {
      return JSON.parse(options.context) as Record<string, unknown>;
    } catch {
      console.error(chalk.red('Invalid JSON in --context option'));
      process.exit(1);
    }
  }

  if (options.contextFile) {
    try {
      const content = await readFile(options.contextFile, 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      console.error(chalk.red(`Failed to load context file: ${options.contextFile}`));
      process.exit(1);
    }
  }

  return {};
}
