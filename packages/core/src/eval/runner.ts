/**
 * @fileoverview Eval test runner
 *
 * Pipeline:
 *   .eval file (YAML)
 *     ↓ load + validate
 *   EvalSuite { config, tests[] }
 *     ↓ for each test
 *     ├── Load variables (from given: or from dataset + params)
 *     ├── Read target prompt.pdk
 *     ├── Render with echo-pdk
 *     ├── If expect_render: run assertions on rendered output
 *     ├── If expect_llm: send to LLM → run assertions on response
 *     ├── If record mode: save response as golden in .dset file
 *     └── Collect results
 *     ↓
 *   EvalSuiteResult { tests[], summary }
 */

import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { createEcho } from '../index.js';
import { loadEvalFile } from './loader.js';
import { runAssertions, type AssertionContext } from './assertions.js';
import { DatasetManager } from './dataset.js';
import { createProvider } from '../providers/registry.js';
import { toLLMProvider } from '../providers/base.js';
import type {
  EvalSuite,
  EvalTest,
  EvalSuiteResult,
  EvalTestResult,
  EvalSummary,
  EvalStatus,
  EvalRunnerConfig,
  LLMResponse,
  AssertionResult,
} from './types.js';

// =============================================================================
// EVAL RUNNER
// =============================================================================

/**
 * Create and run an eval suite from a file.
 */
export async function runEvalFile(
  evalFilePath: string,
  config: EvalRunnerConfig
): Promise<EvalSuiteResult> {
  const suite = await loadEvalFile(evalFilePath);
  return runEvalSuite(suite, evalFilePath, config);
}

/**
 * Run an eval suite.
 */
export async function runEvalSuite(
  suite: EvalSuite,
  evalFilePath: string,
  config: EvalRunnerConfig
): Promise<EvalSuiteResult> {
  const suiteStart = Date.now();

  // Determine prompt directory from eval file location
  // Eval files live in <prompt>/eval/tests/ — go up to prompt dir
  const evalDir = dirname(resolve(evalFilePath));
  const promptDir = resolve(evalDir, '..', '..');

  // Create dataset manager for this prompt
  const datasetManager = new DatasetManager(promptDir);

  // Load the target prompt template
  const targetPath = resolve(promptDir, suite.config.target);
  let template: string;
  try {
    template = await readFile(targetPath, 'utf-8');
  } catch {
    return createErrorResult(suite.suite, `Failed to load target prompt: ${targetPath}`);
  }

  // Create echo instance
  const echo = createEcho({ strict: false });

  // Filter tests if needed
  let tests = suite.tests;
  if (config.filter) {
    const pattern = config.filter.toLowerCase();
    tests = tests.filter((t) => t.name.toLowerCase().includes(pattern));
  }

  // Run each test
  const testResults: EvalTestResult[] = [];
  for (const test of tests) {
    const result = await runSingleTest(test, {
      template,
      echo,
      datasetManager,
      suiteConfig: suite.config,
      runnerConfig: config,
      promptDir,
    });
    testResults.push(result);
  }

  // Compute summary
  const summary = computeSummary(testResults, Date.now() - suiteStart);

  // Determine overall status
  const status: EvalStatus = testResults.some((t) => t.status === 'error')
    ? 'error'
    : testResults.some((t) => t.status === 'fail')
      ? 'fail'
      : 'pass';

  return {
    suiteName: suite.suite,
    status,
    tests: testResults,
    summary,
  };
}

// =============================================================================
// SINGLE TEST RUNNER
// =============================================================================

interface TestContext {
  template: string;
  echo: ReturnType<typeof createEcho>;
  datasetManager: DatasetManager;
  suiteConfig: EvalSuite['config'];
  runnerConfig: EvalRunnerConfig;
  promptDir: string;
}

async function runSingleTest(
  test: EvalTest,
  ctx: TestContext
): Promise<EvalTestResult> {
  const testStart = Date.now();

  try {
    // 1. Resolve variables
    let variables: Record<string, unknown>;
    if (test.given) {
      variables = test.given;
    } else if (test.dataset && test.params) {
      variables = await ctx.datasetManager.getParams(test.dataset, test.params);
    } else if (test.dataset) {
      // Use first parameter set from dataset
      const dataset = await ctx.datasetManager.load(test.dataset);
      if (dataset.parameters.length === 0) {
        throw new Error(`Dataset "${test.dataset}" has no parameter sets`);
      }
      const { name: _name, ...vars } = dataset.parameters[0] as Record<string, unknown>;
      variables = vars;
    } else {
      variables = {};
    }

    const allAssertions: AssertionResult[] = [];
    let renderedOutput: string | undefined;
    let llmResponseText: string | undefined;

    // 2. Render the template
    renderedOutput = await ctx.echo.render(ctx.template, variables);

    // 3. Run expect_render assertions
    if (test.expect_render) {
      const renderCtx: AssertionContext = { text: renderedOutput };
      const results = await runAssertions(test.expect_render, renderCtx);
      allAssertions.push(...results);
    }

    // 4. Run expect_llm assertions (requires LLM call)
    if (test.expect_llm) {
      // For now, LLM provider is optional.
      // If not configured, LLM assertions will return 'error' status.
      const llmProvider = ctx.runnerConfig.aiProvider
        ? toLLMProvider(createProvider(ctx.runnerConfig.aiProvider))
        : undefined;

      let llmResponse: LLMResponse | undefined;

      if (llmProvider) {
        const model = ctx.suiteConfig.model ?? ctx.runnerConfig.aiProvider?.model;
        try {
          llmResponse = await llmProvider.complete(renderedOutput, model);
          llmResponseText = llmResponse.text;
        } catch (llmErr) {
          llmResponseText = '';
          allAssertions.push({
            operator: 'llm_call',
            status: 'error',
            message: `LLM call failed: ${(llmErr as Error).message}`,
          });
        }

        // Record mode — save golden
        if (ctx.runnerConfig.record && test.dataset && llmResponse) {
          await ctx.datasetManager.recordGolden(
            test.dataset,
            llmResponse.text,
            llmResponse
          );
        }
      }

      const llmCtx: AssertionContext = {
        text: llmResponseText ?? '',
        llmResponse,
        llmProvider,
        loadGolden: (name) => ctx.datasetManager.getGolden(name),
      };
      const results = await runAssertions(test.expect_llm, llmCtx);
      allAssertions.push(...results);
    }

    // 5. Determine status
    const status: EvalStatus = allAssertions.some((a) => a.status === 'error')
      ? 'error'
      : allAssertions.some((a) => a.status === 'fail')
        ? 'fail'
        : 'pass';

    return {
      name: test.name,
      status,
      assertions: allAssertions,
      durationMs: Date.now() - testStart,
      renderedOutput,
      llmResponse: llmResponseText,
    };
  } catch (err) {
    return {
      name: test.name,
      status: 'error',
      assertions: [],
      durationMs: Date.now() - testStart,
      error: (err as Error).message,
    };
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function computeSummary(tests: EvalTestResult[], durationMs: number): EvalSummary {
  return {
    total: tests.length,
    passed: tests.filter((t) => t.status === 'pass').length,
    failed: tests.filter((t) => t.status === 'fail').length,
    errored: tests.filter((t) => t.status === 'error').length,
    durationMs,
  };
}

function createErrorResult(suiteName: string, _error: string): EvalSuiteResult {
  return {
    suiteName,
    status: 'error',
    tests: [],
    summary: { total: 0, passed: 0, failed: 0, errored: 0, durationMs: 0 },
  };
}
