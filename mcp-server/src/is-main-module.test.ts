import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isMainModule } from './is-main-module.js';

describe('isMainModule', () => {
  it('returns true when moduleUrl resolves to the same file as process.argv[1]', () => {
    const originalArgv1 = process.argv[1];
    process.argv[1] = fileURLToPath(import.meta.url);
    try {
      expect(isMainModule(import.meta.url)).toBe(true);
    } finally {
      process.argv[1] = originalArgv1;
    }
  });

  it('returns false when moduleUrl does not match process.argv[1]', () => {
    const originalArgv1 = process.argv[1];
    process.argv[1] = '/definitely/not/this/file.js';
    try {
      expect(isMainModule(import.meta.url)).toBe(false);
    } finally {
      process.argv[1] = originalArgv1;
    }
  });

  it('returns false instead of throwing when process.argv[1] is unset', () => {
    const originalArgv1 = process.argv[1];
    // @ts-expect-error — simulating an environment where argv[1] is missing
    process.argv[1] = undefined;
    try {
      expect(isMainModule(import.meta.url)).toBe(false);
    } finally {
      process.argv[1] = originalArgv1;
    }
  });
});
