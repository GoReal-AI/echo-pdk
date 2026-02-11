/**
 * @fileoverview Cosine similarity — pure math, no dependencies.
 */

/**
 * Compute cosine similarity between two vectors.
 *
 * Returns a value in [-1, 1]:
 *   1.0 = identical direction
 *   0.0 = orthogonal
 *  -1.0 = opposite direction
 *
 * @throws Error if vectors have different dimensions or are zero-length.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Dimension mismatch: vector A has ${a.length} dimensions, vector B has ${b.length}`
    );
  }
  if (a.length === 0) {
    throw new Error('Cannot compute cosine similarity of zero-length vectors');
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    magA += ai * ai;
    magB += bi * bi;
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  if (magnitude === 0) {
    return 0;
  }

  return dot / magnitude;
}
