/**
 * fs stub for GraalJS bundle.
 * File system operations are not available in the GraalJS runtime.
 */

export function readFileSync() {
  throw new Error('fs.readFileSync is not available in GraalJS');
}

export function writeFileSync() {
  throw new Error('fs.writeFileSync is not available in GraalJS');
}

export function existsSync() {
  return false;
}

export default { readFileSync, writeFileSync, existsSync };
