import {
  existsSync,
  mkdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { purgeOldScreenshots } from './screenshots.js';

const TEST_DIR = join(process.cwd(), '.test-screenshots-tmp');

describe('purgeOldScreenshots', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  function writeFileWithAge(name: string, ageMs: number) {
    const filePath = join(TEST_DIR, name);
    writeFileSync(filePath, 'fake png data');
    const mtime = new Date(Date.now() - ageMs);
    utimesSync(filePath, mtime, mtime);
    return filePath;
  }

  it('removes files older than maxAgeMs and keeps newer ones', () => {
    const old = writeFileWithAge('old.png', 10 * 24 * 60 * 60 * 1_000);
    const fresh = writeFileWithAge('fresh.png', 1 * 60 * 60 * 1_000);

    const removed = purgeOldScreenshots(7 * 24 * 60 * 60 * 1_000, TEST_DIR);

    expect(removed).toEqual(['old.png']);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
  });

  it('returns an empty array without throwing when the directory does not exist', () => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    expect(purgeOldScreenshots(1_000, TEST_DIR)).toEqual([]);
  });

  it('does nothing when everything is within maxAgeMs', () => {
    writeFileWithAge('fresh.png', 1_000);
    expect(purgeOldScreenshots(7 * 24 * 60 * 60 * 1_000, TEST_DIR)).toEqual([]);
  });
});
