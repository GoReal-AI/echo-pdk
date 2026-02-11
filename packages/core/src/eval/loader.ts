/**
 * @fileoverview Loader for .eval and .dset YAML files
 *
 * Parses and validates eval suite definitions and dataset files.
 */

import { readFile } from 'fs/promises';
import { parse as parseYaml } from 'yaml';
import type {
  EvalSuite,
  EvalSuiteConfig,
  EvalTest,
  Assertion,
  EvalDataset,
  EvalParameterSet,
  EvalGolden,
} from './types.js';

// =============================================================================
// EVAL FILE LOADER
// =============================================================================

/**
 * Load and validate an .eval file from disk.
 */
export async function loadEvalFile(filePath: string): Promise<EvalSuite> {
  const content = await readFile(filePath, 'utf-8');
  return parseEvalContent(content, filePath);
}

/**
 * Parse .eval YAML content into an EvalSuite.
 */
export function parseEvalContent(content: string, source?: string): EvalSuite {
  const raw = parseYaml(content) as Record<string, unknown>;

  if (!raw || typeof raw !== 'object') {
    throw new EvalLoadError('Invalid .eval file: expected YAML object', source);
  }

  // Validate required fields
  if (typeof raw.suite !== 'string') {
    throw new EvalLoadError('Missing required field: suite', source);
  }

  if (!Array.isArray(raw.tests) || raw.tests.length === 0) {
    throw new EvalLoadError('Missing or empty required field: tests', source);
  }

  // Parse config
  const config = parseConfig(raw.config as Record<string, unknown> | undefined, source);

  // Parse tests
  const tests = (raw.tests as Record<string, unknown>[]).map((t, i) =>
    parseTest(t, i, source)
  );

  return {
    suite: raw.suite as string,
    config,
    tests,
  };
}

function parseConfig(
  raw: Record<string, unknown> | undefined,
  _source?: string
): EvalSuiteConfig {
  if (!raw || typeof raw !== 'object') {
    return { target: 'prompt.pdk' };
  }

  return {
    target: typeof raw.target === 'string' ? raw.target : 'prompt.pdk',
    model: typeof raw.model === 'string' ? raw.model : undefined,
    timeout: typeof raw.timeout === 'number' ? raw.timeout : undefined,
  };
}

function parseTest(
  raw: Record<string, unknown>,
  index: number,
  source?: string
): EvalTest {
  if (typeof raw.name !== 'string') {
    throw new EvalLoadError(`Test at index ${index} missing required field: name`, source);
  }

  const test: EvalTest = {
    name: raw.name as string,
  };

  if (raw.given && typeof raw.given === 'object') {
    test.given = raw.given as Record<string, unknown>;
  }

  if (typeof raw.dataset === 'string') {
    test.dataset = raw.dataset;
  }

  if (typeof raw.params === 'string') {
    test.params = raw.params;
  }

  if (Array.isArray(raw.expect_render)) {
    test.expect_render = raw.expect_render.map((a, i) =>
      parseAssertion(a as Record<string, unknown>, i, raw.name as string, source)
    );
  }

  if (Array.isArray(raw.expect_llm)) {
    test.expect_llm = raw.expect_llm.map((a, i) =>
      parseAssertion(a as Record<string, unknown>, i, raw.name as string, source)
    );
  }

  if (!test.expect_render && !test.expect_llm) {
    throw new EvalLoadError(
      `Test "${test.name}" has no assertions (need expect_render or expect_llm)`,
      source
    );
  }

  return test;
}

/**
 * Parse a single assertion from YAML.
 * Each assertion is a single-key object.
 */
function parseAssertion(
  raw: Record<string, unknown>,
  index: number,
  testName: string,
  source?: string
): Assertion {
  const keys = Object.keys(raw);
  if (keys.length === 0) {
    throw new EvalLoadError(
      `Empty assertion at index ${index} in test "${testName}"`,
      source
    );
  }

  // The first key is the operator
  const operator = keys[0] as string;
  const value = raw[operator];

  // Validate known operators
  const knownOperators = new Set([
    'contains', 'not_contains', 'equals', 'matches',
    'starts_with', 'ends_with', 'length', 'word_count',
    'json_valid', 'json_schema', 'llm_judge', 'similar_to',
    'sentiment', 'latency', 'token_count', 'cost',
  ]);

  if (!knownOperators.has(operator)) {
    throw new EvalLoadError(
      `Unknown assertion operator "${operator}" in test "${testName}"`,
      source
    );
  }

  // Return as-is — the runner will handle type checking per operator
  return { [operator]: value } as Assertion;
}

// =============================================================================
// DATASET FILE LOADER
// =============================================================================

/**
 * Load and validate a .dset file from disk.
 */
export async function loadDatasetFile(filePath: string): Promise<EvalDataset> {
  const content = await readFile(filePath, 'utf-8');
  return parseDatasetContent(content, filePath);
}

/**
 * Parse .dset YAML content into an EvalDataset.
 */
export function parseDatasetContent(content: string, source?: string): EvalDataset {
  const raw = parseYaml(content) as Record<string, unknown>;

  if (!raw || typeof raw !== 'object') {
    throw new EvalLoadError('Invalid .dset file: expected YAML object', source);
  }

  if (typeof raw.name !== 'string') {
    throw new EvalLoadError('Missing required field: name', source);
  }

  if (!Array.isArray(raw.parameters) || raw.parameters.length === 0) {
    throw new EvalLoadError('Missing or empty required field: parameters', source);
  }

  // Parse golden
  let golden: EvalGolden | undefined;
  if (raw.golden && typeof raw.golden === 'object') {
    const g = raw.golden as Record<string, unknown>;
    golden = {
      response: typeof g.response === 'string' ? g.response : '',
      model: typeof g.model === 'string' ? g.model : undefined,
      recorded_at: typeof g.recorded_at === 'string' ? g.recorded_at : undefined,
      metadata: g.metadata && typeof g.metadata === 'object'
        ? g.metadata as Record<string, unknown>
        : undefined,
    };
  }

  // Parse parameters
  const parameters: EvalParameterSet[] = (raw.parameters as Record<string, unknown>[]).map(
    (p, i) => {
      if (typeof p.name !== 'string') {
        throw new EvalLoadError(`Parameter set at index ${i} missing required field: name`, source);
      }
      return p as EvalParameterSet;
    }
  );

  return {
    name: raw.name as string,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    golden,
    parameters,
  };
}

// =============================================================================
// ERROR TYPE
// =============================================================================

/**
 * Error thrown when loading/parsing eval or dataset files.
 */
export class EvalLoadError extends Error {
  constructor(
    message: string,
    public source?: string
  ) {
    super(source ? `${message} (in ${source})` : message);
    this.name = 'EvalLoadError';
  }
}
