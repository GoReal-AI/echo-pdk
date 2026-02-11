/**
 * @fileoverview Eval Command - Run evaluation suites
 *
 * Usage:
 *   echopdk eval                              # Run all .eval files
 *   echopdk eval tests/smoke.eval             # Run specific eval
 *   echopdk eval --record                     # Record goldens
 *   echopdk eval --filter "family"            # Filter by test name
 *   echopdk eval --reporter json              # JSON output for CI
 *   echopdk --api-key sk-... eval             # Use explicit API key
 */

import { readdir, stat } from 'fs/promises';
import { join, resolve, relative } from 'path';
import { runEvalFile, formatResults } from '@goreal-ai/echo-pdk';
import { isProviderType } from '@goreal-ai/echo-pdk';
import type { EvalRunnerConfig, EvalSuiteResult } from '@goreal-ai/echo-pdk';
import chalk from 'chalk';
import ora from 'ora';
import { resolveApiKey, loadWorkspaceAIConfig } from '../ai-provider.js';

// =============================================================================
// TYPES
// =============================================================================

interface EvalOptions {
  record?: boolean;
  filter?: string;
  reporter?: 'console' | 'json' | 'junit';
  model?: string;
  apiKey?: string;
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

/**
 * Eval command handler.
 */
export async function evalCommand(
  evalPath: string | undefined,
  options: EvalOptions
): Promise<void> {
  const reporter = options.reporter || 'console';
  const workDir = resolve(process.cwd());

  // Build runner config
  const runnerConfig: EvalRunnerConfig = {
    workDir,
    filter: options.filter,
    record: options.record,
    reporter,
  };

  // Resolve API key from --api-key flag or env vars
  const apiKey = resolveApiKey(options.apiKey);
  if (apiKey) {
    const workspace = loadWorkspaceAIConfig();
    const rawType = workspace?.provider ?? 'openai';
    if (!isProviderType(rawType)) {
      console.error(chalk.red(`Unknown AI provider "${rawType}". Supported: openai, anthropic.`));
      process.exit(1);
    }
    runnerConfig.aiProvider = {
      type: rawType,
      apiKey,
      model: options.model || process.env.ECHO_EVAL_MODEL || 'gpt-4o-mini',
    };
  }

  // Find eval files
  const evalFiles = await findEvalFiles(workDir, evalPath);

  if (evalFiles.length === 0) {
    console.log(chalk.yellow('No .eval files found.'));
    console.log(chalk.dim('\nCreate one in eval/tests/ within your prompt directory.'));
    return;
  }

  if (!apiKey && reporter === 'console') {
    console.log(chalk.dim('No API key configured — expect_llm assertions will be skipped.'));
    console.log(chalk.dim('Set OPENAI_API_KEY or use --api-key to enable LLM tests.\n'));
  }

  // Run each eval file
  const results: EvalSuiteResult[] = [];
  let hasFailures = false;

  for (const file of evalFiles) {
    const relPath = relative(workDir, file);

    if (reporter === 'console') {
      const spinner = ora(`Running ${relPath}...`).start();
      try {
        const result = await runEvalFile(file, runnerConfig);
        results.push(result);

        if (result.status === 'pass') {
          spinner.succeed(`${relPath}`);
        } else {
          spinner.fail(`${relPath}`);
          hasFailures = true;
        }

        console.log(formatResults(result, 'console'));
      } catch (err) {
        spinner.fail(`${relPath}: ${(err as Error).message}`);
        hasFailures = true;
      }
    } else {
      // Non-interactive reporters — no spinner
      try {
        const result = await runEvalFile(file, runnerConfig);
        results.push(result);
        if (result.status !== 'pass') hasFailures = true;
      } catch (err) {
        console.error(`Error running ${relPath}: ${(err as Error).message}`);
        hasFailures = true;
      }
    }
  }

  // Final output for non-console reporters
  if (reporter !== 'console' && results.length > 0) {
    for (const result of results) {
      console.log(formatResults(result, reporter));
    }
  }

  // Summary (console reporter)
  if (reporter === 'console' && results.length > 1) {
    const totalTests = results.reduce((sum, r) => sum + r.summary.total, 0);
    const totalPassed = results.reduce((sum, r) => sum + r.summary.passed, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.summary.failed, 0);

    console.log(chalk.bold('\nOverall Summary:'));
    console.log(`  Suites: ${results.length}`);
    console.log(`  Tests:  ${totalPassed} passed, ${totalFailed} failed, ${totalTests} total`);
  }

  if (options.record) {
    console.log(chalk.cyan('\n✓ Golden responses recorded to .dset files'));
  }

  if (hasFailures) {
    process.exit(1);
  }
}

// =============================================================================
// FILE DISCOVERY
// =============================================================================

/**
 * Find .eval files to run.
 */
async function findEvalFiles(workDir: string, evalPath?: string): Promise<string[]> {
  if (evalPath) {
    // Specific file or relative path
    const fullPath = resolve(workDir, evalPath);
    try {
      const s = await stat(fullPath);
      if (s.isFile()) {
        return [fullPath];
      }
    } catch {
      // Not found as-is, try with .eval extension
      try {
        const withExt = fullPath.endsWith('.eval') ? fullPath : `${fullPath}.eval`;
        await stat(withExt);
        return [withExt];
      } catch {
        console.error(chalk.red(`Eval file not found: ${evalPath}`));
        return [];
      }
    }
  }

  // Discover all .eval files recursively
  return await discoverEvalFiles(workDir);
}

/**
 * Recursively find all .eval files in subdirectories.
 */
async function discoverEvalFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, dist, .git
        if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
        const nested = await discoverEvalFiles(fullPath);
        results.push(...nested);
      } else if (entry.isFile() && entry.name.endsWith('.eval')) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory not readable — skip
  }

  return results;
}
