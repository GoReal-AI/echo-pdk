/**
 * @fileoverview Eval result reporters
 *
 * Formats EvalSuiteResult for different output targets:
 * - Console: colorful human-readable output
 * - JSON: structured data for programmatic use
 * - JUnit XML: CI integration format
 */

import type { EvalSuiteResult } from './types.js';

// =============================================================================
// CONSOLE REPORTER
// =============================================================================

/**
 * Format eval results for console output with colors (ANSI).
 */
export function formatConsole(result: EvalSuiteResult): string {
  const lines: string[] = [];
  const { suiteName, tests, summary } = result;

  // Header
  const statusIcon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⚠';
  const statusColor = result.status === 'pass' ? '\x1b[32m' : result.status === 'fail' ? '\x1b[31m' : '\x1b[33m';
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';
  const bold = '\x1b[1m';

  lines.push(`\n${bold}${statusColor}${statusIcon} ${suiteName}${reset}`);
  lines.push(`${dim}${'─'.repeat(60)}${reset}`);

  // Tests
  for (const test of tests) {
    const icon = test.status === 'pass' ? '\x1b[32m✓' : test.status === 'fail' ? '\x1b[31m✗' : '\x1b[33m⚠';
    const duration = test.durationMs != null ? ` ${dim}(${test.durationMs}ms)${reset}` : '';
    lines.push(`  ${icon} ${test.name}${reset}${duration}`);

    if (test.error) {
      lines.push(`    \x1b[31mError: ${test.error}${reset}`);
    }

    // Show rendered prompt if available
    if (test.renderedOutput) {
      lines.push(`    ${dim}Rendered prompt:${reset}`);
      const renderedLines = test.renderedOutput.split('\n');
      for (const rl of renderedLines) {
        lines.push(`    ${dim}  ${rl}${reset}`);
      }
    }

    // Show LLM response if available (use !== undefined to handle empty strings)
    if (test.llmResponse !== undefined) {
      lines.push(`    ${dim}LLM response:${reset}`);
      if (test.llmResponse) {
        const responseLines = test.llmResponse.split('\n');
        for (const rl of responseLines) {
          lines.push(`    ${dim}  ${rl}${reset}`);
        }
      } else {
        lines.push(`    ${dim}  (empty — model may have returned an error)${reset}`);
      }
    }

    // Show assertions
    for (const assertion of test.assertions) {
      if (assertion.status !== 'pass') {
        const aIcon = assertion.status === 'fail' ? '\x1b[31m✗' : '\x1b[33m⚠';
        const msg = assertion.message ?? `${assertion.operator} failed`;
        lines.push(`    ${aIcon} ${assertion.operator}: ${msg}${reset}`);
        if (assertion.expected) {
          lines.push(`      ${dim}expected: ${assertion.expected}${reset}`);
        }
        if (assertion.actual) {
          lines.push(`      ${dim}actual:   ${assertion.actual}${reset}`);
        }
      } else if (assertion.operator === 'llm_judge' || assertion.operator === 'sentiment') {
        // Always show reasoning for AI assertions, even on pass
        lines.push(`    \x1b[32m✓ ${assertion.operator}:${reset} ${dim}${assertion.message ?? 'passed'}${reset}`);
      }
    }
  }

  // Summary
  lines.push(`${dim}${'─'.repeat(60)}${reset}`);
  const parts: string[] = [];
  if (summary.passed > 0) parts.push(`\x1b[32m${summary.passed} passed${reset}`);
  if (summary.failed > 0) parts.push(`\x1b[31m${summary.failed} failed${reset}`);
  if (summary.errored > 0) parts.push(`\x1b[33m${summary.errored} errored${reset}`);
  parts.push(`${summary.total} total`);
  lines.push(`  ${parts.join(', ')} ${dim}(${summary.durationMs}ms)${reset}`);
  lines.push('');

  return lines.join('\n');
}

// =============================================================================
// JSON REPORTER
// =============================================================================

/**
 * Format eval results as JSON string.
 */
export function formatJson(result: EvalSuiteResult): string {
  return JSON.stringify(result, null, 2);
}

// =============================================================================
// JUNIT XML REPORTER
// =============================================================================

/**
 * Format eval results as JUnit XML for CI integration.
 */
export function formatJunit(result: EvalSuiteResult): string {
  const { suiteName, tests, summary } = result;

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<testsuite name="${escapeXml(suiteName)}" tests="${summary.total}" ` +
      `failures="${summary.failed}" errors="${summary.errored}" ` +
      `time="${(summary.durationMs / 1000).toFixed(3)}">`
  );

  for (const test of tests) {
    const time = test.durationMs != null ? ` time="${(test.durationMs / 1000).toFixed(3)}"` : '';
    lines.push(`  <testcase name="${escapeXml(test.name)}"${time}>`);

    if (test.status === 'fail') {
      const failedAssertions = test.assertions.filter((a) => a.status === 'fail');
      const message = failedAssertions
        .map((a) => a.message ?? `${a.operator} failed`)
        .join('; ');
      lines.push(`    <failure message="${escapeXml(message)}">`);
      for (const a of failedAssertions) {
        lines.push(`      [${a.operator}] ${a.message ?? 'failed'}`);
        if (a.expected) lines.push(`        expected: ${a.expected}`);
        if (a.actual) lines.push(`        actual: ${a.actual}`);
      }
      lines.push('    </failure>');
    }

    if (test.status === 'error') {
      const errorMsg = test.error ?? 'Unknown error';
      lines.push(`    <error message="${escapeXml(errorMsg)}">${escapeXml(errorMsg)}</error>`);
    }

    lines.push('  </testcase>');
  }

  lines.push('</testsuite>');
  return lines.join('\n');
}

// =============================================================================
// FORMAT SELECTOR
// =============================================================================

/**
 * Format eval results using the specified reporter.
 */
export function formatResults(
  result: EvalSuiteResult,
  reporter: 'console' | 'json' | 'junit' = 'console'
): string {
  switch (reporter) {
    case 'console':
      return formatConsole(result);
    case 'json':
      return formatJson(result);
    case 'junit':
      return formatJunit(result);
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
