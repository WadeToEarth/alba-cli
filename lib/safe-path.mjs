import { resolve, relative } from 'path';

/**
 * Resolves untrusted path relative to baseDir and verifies it stays within baseDir.
 * Throws if the resolved path escapes baseDir (path traversal).
 */
export function safePath(baseDir, untrusted) {
  const resolved = resolve(baseDir, untrusted);
  const rel = relative(baseDir, resolved);
  if (rel.startsWith('..') || resolve(baseDir, rel) !== resolved) {
    throw new Error(`Path traversal blocked: ${untrusted}`);
  }
  return resolved;
}
