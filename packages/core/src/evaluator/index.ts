/**
 * @fileoverview Evaluator module exports
 */

export {
  evaluate,
  evaluateCondition,
  evaluateConditional,
  resolveVariable,
  preEvaluateAiJudges,
  createEvaluationContext,
} from './evaluator.js';

export type { EvaluationContext, EvaluatedNode } from './evaluator.js';

export {
  builtinOperators,
  getOperator,
  isAsyncOperator,
  // Individual operators for testing
  equalsOperator,
  containsOperator,
  existsOperator,
  matchesOperator,
  gtOperator,
  gteOperator,
  ltOperator,
  lteOperator,
  inOperator,
  aiGateOperator,
  aiJudgeOperator,
} from './operators.js';
