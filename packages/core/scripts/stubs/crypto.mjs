/**
 * Crypto stub for GraalJS bundle.
 * The crypto module is only used for AI judge caching, which we skip in Java.
 */

export function createHash() {
  return {
    update: () => ({ digest: () => 'stub-hash' }),
  };
}

export default { createHash };
