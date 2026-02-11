/**
 * @fileoverview Eval types for Echo PDK prompt testing
 *
 * Defines all types for the evaluation system:
 * - Eval suite and test definitions (.eval files)
 * - Dataset definitions (.dset files)
 * - Assertion types and results
 * - Runner configuration and output
 */

import type { ProviderConfig, ProviderType } from '../providers/types.js';

// =============================================================================
// EVAL SUITE TYPES (.eval files)
// =============================================================================

/**
 * A complete eval suite loaded from a .eval file.
 */
export interface EvalSuite {
  /** Suite name */
  suite: string;
  /** Suite-level configuration */
  config: EvalSuiteConfig;
  /** Array of tests */
  tests: EvalTest[];
}

/**
 * Configuration for an eval suite.
 */
export interface EvalSuiteConfig {
  /** Target prompt file (relative to prompt dir) */
  target: string;
  /** Default model for LLM tests */
  model?: string;
  /** Default timeout in milliseconds */
  timeout?: number;
}

/**
 * A single eval test within a suite.
 */
export interface EvalTest {
  /** Test name */
  name: string;
  /** Variables to render with (inline) */
  given?: Record<string, unknown>;
  /** Dataset reference for loading variables */
  dataset?: string;
  /** Parameter set name within the dataset */
  params?: string;
  /** Assertions against rendered template output (no LLM) */
  expect_render?: Assertion[];
  /** Assertions against LLM response output */
  expect_llm?: Assertion[];
}

// =============================================================================
// ASSERTION TYPES
// =============================================================================

/**
 * Union of all assertion types.
 * Each assertion is a single-key object where the key is the operator.
 */
export type Assertion =
  | { contains: string }
  | { not_contains: string }
  | { equals: string }
  | { matches: string }
  | { starts_with: string }
  | { ends_with: string }
  | { length: { min?: number; max?: number } }
  | { word_count: { min?: number; max?: number } }
  | { json_valid: boolean }
  | { json_schema: string }
  | { llm_judge: string }
  | { similar_to: { dataset: string; threshold: number } }
  | { sentiment: 'positive' | 'negative' | 'neutral' | 'helpful' }
  | { latency: { max: number } }
  | { token_count: { max?: number; min?: number } }
  | { cost: { max: number } };

/**
 * Known assertion operator names.
 */
export type AssertionOperator =
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'matches'
  | 'starts_with'
  | 'ends_with'
  | 'length'
  | 'word_count'
  | 'json_valid'
  | 'json_schema'
  | 'llm_judge'
  | 'similar_to'
  | 'sentiment'
  | 'latency'
  | 'token_count'
  | 'cost';

// =============================================================================
// DATASET TYPES (.dset files)
// =============================================================================

/**
 * A dataset loaded from a .dset file.
 * Contains a golden response and multiple parameter sets.
 */
export interface EvalDataset {
  /** Dataset name */
  name: string;
  /** Description */
  description?: string;
  /** Golden reference response */
  golden?: EvalGolden;
  /** Array of parameter sets */
  parameters: EvalParameterSet[];
}

/**
 * A golden (reference) response for comparison.
 */
export interface EvalGolden {
  /** The reference response text */
  response: string;
  /** Model that produced it */
  model?: string;
  /** When it was recorded */
  recorded_at?: string;
  /** Optional metadata (tokens, latency, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * A named set of parameters (prompt variables).
 */
export interface EvalParameterSet {
  /** Parameter set name (used to reference from .eval files) */
  name: string;
  /** Key-value pairs for prompt variables */
  [key: string]: unknown;
}

// =============================================================================
// EVAL RESULTS
// =============================================================================

/**
 * Result of running an entire eval suite.
 */
export interface EvalSuiteResult {
  /** Suite name */
  suiteName: string;
  /** Overall status */
  status: EvalStatus;
  /** Individual test results */
  tests: EvalTestResult[];
  /** Summary statistics */
  summary: EvalSummary;
}

/**
 * Result of a single test.
 */
export interface EvalTestResult {
  /** Test name */
  name: string;
  /** Test status */
  status: EvalStatus;
  /** Assertion results */
  assertions: AssertionResult[];
  /** Duration in milliseconds */
  durationMs?: number;
  /** Error message if status is 'error' */
  error?: string;
  /** The rendered output (for debugging) */
  renderedOutput?: string;
  /** The LLM response (for debugging) */
  llmResponse?: string;
}

/**
 * Result of a single assertion.
 */
export interface AssertionResult {
  /** The assertion operator */
  operator: string;
  /** Pass/fail/error status */
  status: EvalStatus;
  /** What was expected */
  expected?: string;
  /** What was actually found */
  actual?: string;
  /** Human-readable message */
  message?: string;
}

/**
 * Summary statistics for a suite run.
 */
export interface EvalSummary {
  total: number;
  passed: number;
  failed: number;
  errored: number;
  durationMs: number;
}

/**
 * Status enum for tests and assertions.
 */
export type EvalStatus = 'pass' | 'fail' | 'error';

// =============================================================================
// RUNNER CONFIGURATION
// =============================================================================

/**
 * Configuration for the eval runner.
 */
export interface EvalRunnerConfig {
  /** Working directory (prompt workspace root) */
  workDir: string;
  /** Filter tests by name pattern */
  filter?: string;
  /** Record mode — save LLM responses as goldens */
  record?: boolean;
  /** Output reporter type */
  reporter?: 'console' | 'json' | 'junit';
  /** AI provider config for LLM tests */
  aiProvider?: ProviderConfig;
}

/**
 * Handler for assertions that need an LLM call.
 */
export interface LLMProvider {
  /** Send a prompt to an LLM and get a response */
  complete(prompt: string, model?: string): Promise<LLMResponse>;
  /** Judge a response against a question — returns verdict + reasoning */
  judge(response: string, question: string): Promise<{ pass: boolean; reasoning: string }>;
  /** Get embedding similarity between two texts */
  similarity(textA: string, textB: string): Promise<number>;
}

/**
 * Response from an LLM call.
 */
export interface LLMResponse {
  /** The response text */
  text: string;
  /** Token usage */
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Latency in milliseconds */
  latencyMs: number;
  /** Cost in USD (estimated) */
  costUsd?: number;
  /** Model used */
  model: string;
  /** Provider type (added by unified provider system) */
  provider?: ProviderType;
}
