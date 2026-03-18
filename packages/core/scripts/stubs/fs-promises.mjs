/**
 * fs/promises stub for GraalJS bundle.
 * File system operations are only used by the CLI eval runner (loader.ts, dataset.ts, runner.ts).
 * In Java, datasets and eval runs are managed via the database, not the filesystem.
 */

export async function readFile() {
  throw new Error('fs/promises.readFile is not available in GraalJS');
}

export async function writeFile() {
  throw new Error('fs/promises.writeFile is not available in GraalJS');
}

export async function readdir() {
  throw new Error('fs/promises.readdir is not available in GraalJS');
}

export async function stat() {
  throw new Error('fs/promises.stat is not available in GraalJS');
}

export async function mkdir() {
  throw new Error('fs/promises.mkdir is not available in GraalJS');
}

export default { readFile, writeFile, readdir, stat, mkdir };
