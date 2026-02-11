/**
 * @fileoverview Echo PDK Eval Module - Public API
 *
 * Exports the eval runner, loader, assertions, dataset manager,
 * and reporter for prompt evaluation and testing.
 */

// Types
export type {
  EvalSuite,
  EvalSuiteConfig,
  EvalTest,
  Assertion,
  AssertionOperator,
  EvalDataset,
  EvalGolden,
  EvalParameterSet,
  EvalSuiteResult,
  EvalTestResult,
  AssertionResult,
  EvalSummary,
  EvalStatus,
  EvalRunnerConfig,
  LLMProvider,
  LLMResponse,
} from './types.js';

// Loader
export {
  loadEvalFile,
  parseEvalContent,
  loadDatasetFile,
  parseDatasetContent,
  EvalLoadError,
} from './loader.js';

// Assertions
export { runAssertion, runAssertions } from './assertions.js';
export type { AssertionContext } from './assertions.js';

// Dataset
export { DatasetManager } from './dataset.js';

// Runner
export { runEvalFile, runEvalSuite } from './runner.js';

// Reporter
export {
  formatConsole,
  formatJson,
  formatJunit,
  formatResults,
} from './reporter.js';
