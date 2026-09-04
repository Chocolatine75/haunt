import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ActionDecider } from '../cli/providers/types.js';
import { SessionManager } from '../session/manager.js';
import type { Issue } from '../types.js';
import type { ReportJudge } from './judge/types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const GROUND_TRUTH_FIXTURE = resolve(
  __dirname,
  '__fixtures__/ground-truth.json',
);

// persona/loader.ts resolves the built-in personas dir relative to wherever
// it's actually loaded from: two levels up reaches the repo root when
// bundled to dist/, but lands one directory short (mcp-server/) when Vitest
// runs directly against this TS source. runBenchmark below drives a real
// (fixed) 'confused-beginner' persona through runHeadlessTest, so point
// HAUNT_PERSONAS_DIR at the real repo personas/ dir here, relative to this
// file, so the test passes regardless of who checks out the repo or where.
//
// This has to happen *before* run.js (which transitively imports
// persona/loader.ts) is evaluated, because loader.ts reads
// process.env.HAUNT_PERSONAS_DIR into a module-level constant once, at
// import time. A static `import './run.js'` at the top of this file would
// have already resolved that constant before the line above ever ran, so
// run.js is imported dynamically here instead, after the env var is set.
process.env.HAUNT_PERSONAS_DIR ??= resolve(__dirname, '../../../personas');
const { parseArgs, runBenchmark } = await import('./run.js');

describe('parseArgs', () => {
  it('applies defaults when nothing is passed', () => {
    const options = parseArgs([]);
    expect(options).toEqual({
      targetUrl: 'http://localhost:3000',
      groundTruthPath: 'demo/benchmark-ground-truth.json',
      provider: undefined,
      model: undefined,
      outPath: undefined,
    });
  });

  it('parses a positional URL and all flags', () => {
    const options = parseArgs([
      'http://localhost:4000',
      '--ground-truth',
      './custom-ground-truth.json',
      '--provider',
      'mistral',
      '--model',
      'mistral-small-latest',
      '--out',
      './scorecard.json',
    ]);
    expect(options).toEqual({
      targetUrl: 'http://localhost:4000',
      groundTruthPath: './custom-ground-truth.json',
      provider: 'mistral',
      model: 'mistral-small-latest',
      outPath: './scorecard.json',
    });
  });

  it('throws on an unknown --provider value', () => {
    expect(() => parseArgs(['--provider', 'openai'])).toThrow(
      /--provider must be "anthropic" or "mistral"/,
    );
  });
});

function fakeDecider(): ActionDecider {
  return async () => ({ action: 'press A', issues: [] });
}

function fakeJudge(
  overrides: Partial<Awaited<ReturnType<ReportJudge>>> = {},
): ReportJudge {
  return async () => ({
    matched: [],
    missed_ground_truth_ids: ['test-bug-one', 'test-bug-two'],
    false_positives: [],
    actionable_count: 0,
    reasoning: 'Nothing matched in this fake run.',
    ...overrides,
  });
}

describe('runBenchmark', () => {
  it('wires the report, format check, and judge verdict into a scorecard', async () => {
    const manager = new SessionManager();
    const decide = fakeDecider();
    const judge = fakeJudge({
      matched: [
        { ground_truth_id: 'test-bug-one', matched_issue_description: 'desc' },
      ],
      missed_ground_truth_ids: ['test-bug-two'],
      false_positives: [
        { description: 'not real', reason: 'tooling artifact' },
      ],
      actionable_count: 1,
    });

    const scorecard = await runBenchmark(decide, judge, manager, {
      targetUrl: 'data:text/html,<input type="text" />',
      groundTruthPath: GROUND_TRUTH_FIXTURE,
    });

    expect(scorecard.ground_truth_total).toBe(2);
    expect(scorecard.recall).toBe(1);
    expect(scorecard.missed_ground_truth_ids).toEqual(['test-bug-two']);
    expect(scorecard.false_positive_count).toBe(1);
    expect(scorecard.actionable_count).toBe(1);
    expect(scorecard.format_ok).toBe(true);
    expect(scorecard.format_missing).toEqual([]);
    expect(scorecard.report_path).toContain('.md');
  }, 15_000);
});
