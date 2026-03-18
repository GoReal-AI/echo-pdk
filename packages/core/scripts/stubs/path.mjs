/**
 * path stub for GraalJS bundle.
 * Path operations are only used by the CLI eval runner (dataset.ts, runner.ts).
 * In Java, file paths are managed by the JVM, not JavaScript.
 */

export function join(...parts) {
  return parts.filter(Boolean).join('/');
}

export function resolve(...parts) {
  return parts.filter(Boolean).join('/');
}

export function dirname(p) {
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.substring(0, i) : '.';
}

export function basename(p, ext) {
  let base = p.substring(p.lastIndexOf('/') + 1);
  if (ext && base.endsWith(ext)) {
    base = base.substring(0, base.length - ext.length);
  }
  return base;
}

export function extname(p) {
  const i = p.lastIndexOf('.');
  return i >= 0 ? p.substring(i) : '';
}

export default { join, resolve, dirname, basename, extname };
