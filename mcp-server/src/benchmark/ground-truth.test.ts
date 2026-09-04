import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadGroundTruth } from './ground-truth.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURE = resolve(__dirname, '__fixtures__/ground-truth.json');

function writeTempJson(data: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'haunt-benchmark-test-'));
  const path = join(dir, 'ground-truth.json');
  writeFileSync(path, JSON.stringify(data), 'utf-8');
  return path;
}

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

  it('throws a clear error when an entry is missing a required field', () => {
    const path = writeTempJson([
      { id: 'bug-1', route: '/foo', category: 'ux' }, // missing description
    ]);
    expect(() => loadGroundTruth(path)).toThrow(
      /entry at index 0 is missing or has an invalid "description"/,
    );
  });

  it('throws a clear error when an entry has an invalid category', () => {
    const path = writeTempJson([
      {
        id: 'bug-1',
        route: '/foo',
        description: 'Something breaks',
        category: 'not-a-real-category',
      },
    ]);
    expect(() => loadGroundTruth(path)).toThrow(
      /entry at index 0 is missing or has an invalid "category"/,
    );
  });

  it('names the file path and the index of the first invalid entry', () => {
    const path = writeTempJson([
      {
        id: 'bug-1',
        route: '/foo',
        description: 'Something breaks',
        category: 'ux',
      },
      { id: '', route: '/bar', description: 'Also breaks', category: 'ux' }, // empty id
    ]);
    expect(() => loadGroundTruth(path)).toThrow(
      new RegExp(
        `${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: entry at index 1 is missing or has an invalid "id"`,
      ),
    );
  });
});
