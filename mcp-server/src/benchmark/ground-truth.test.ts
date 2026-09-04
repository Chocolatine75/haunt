import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadGroundTruth } from './ground-truth.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURE = resolve(__dirname, '__fixtures__/ground-truth.json');

describe('loadGroundTruth', () => {
  it('loads and parses a ground-truth JSON file', () => {
    const bugs = loadGroundTruth(FIXTURE);
    expect(bugs).toHaveLength(2);
    expect(bugs[0]).toEqual({
      id: 'test-bug-one',
      route: '/foo',
      description: 'Something breaks on /foo',
      category: 'ux',
    });
  });

  it('throws a clear error when the file does not contain a JSON array', () => {
    expect(() =>
      loadGroundTruth(resolve(__dirname, 'ground-truth.ts')),
    ).toThrow();
  });

  it('throws when the file does not exist', () => {
    expect(() => loadGroundTruth('/no/such/file.json')).toThrow();
  });
});
