import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ActionDecider } from '../cli/providers/types.js';
import { SessionManager } from '../session/manager.js';
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
const { parseArgs, runBenchmark, isHelpRequested } = await import('./run.js');

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

  it('parses --email, --password, and --login-url', () => {
    const options = parseArgs([
      '--email',
      'test@example.com',
      '--password',
      'password123',
      '--login-url',
      'http://localhost:3000/auth/login',
    ]);
    expect(options.email).toBe('test@example.com');
    expect(options.password).toBe('password123');
    expect(options.loginUrl).toBe('http://localhost:3000/auth/login');
  });

  it('throws when only --email is given without --password', () => {
    expect(() => parseArgs(['--email', 'test@example.com'])).toThrow(
      /--email and --password must be given together/,
    );
  });
});

describe('isHelpRequested', () => {
  it('detects --help', () => {
    expect(isHelpRequested(['--help'])).toBe(true);
  });

  it('detects -h', () => {
    expect(isHelpRequested(['-h'])).toBe(true);
  });

  it('detects --help mixed in with other args', () => {
    expect(
      isHelpRequested(['http://localhost:3000', '--help', '--provider']),
    ).toBe(true);
  });

  it('returns false when no help flag is present', () => {
    expect(isHelpRequested([])).toBe(false);
    expect(
      isHelpRequested(['http://localhost:3000', '--provider', 'mistral']),
    ).toBe(false);
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
    expect(scorecard.unreconciled_ids).toBeUndefined();
  }, 15_000);

  it('reconciles a hallucinated ground-truth id out of recall and surfaces it as unreconciled', async () => {
    const manager = new SessionManager();
    const decide = fakeDecider();
    // The judge claims a match on a real bug (test-bug-one) and a *fake*
    // bug id that doesn't exist in ground truth. It never mentions
    // test-bug-two at all, so its own missed_ground_truth_ids can't be
    // trusted either -- runBenchmark must recompute it itself.
    const judge = fakeJudge({
      matched: [
        { ground_truth_id: 'test-bug-one', matched_issue_description: 'desc' },
        {
          ground_truth_id: 'not-a-real-ground-truth-id',
          matched_issue_description: 'hallucinated match',
        },
      ],
      missed_ground_truth_ids: [], // judge (wrongly) claims nothing was missed
      false_positives: [],
      actionable_count: 1,
    });

    const scorecard = await runBenchmark(decide, judge, manager, {
      targetUrl: 'data:text/html,<input type="text" />',
      groundTruthPath: GROUND_TRUTH_FIXTURE,
    });

    // Only the real match counts toward recall.
    expect(scorecard.recall).toBe(1);
    // The hallucinated id is surfaced, not silently trusted.
    expect(scorecard.unreconciled_ids).toEqual(['not-a-real-ground-truth-id']);
    // test-bug-two is recomputed as missed even though the judge's own
    // missed_ground_truth_ids said nothing was missed.
    expect(scorecard.missed_ground_truth_ids).toEqual(['test-bug-two']);
  }, 15_000);

  it('dedupes a real ground-truth id the judge lists twice in matched', async () => {
    const manager = new SessionManager();
    const decide = fakeDecider();
    const judge = fakeJudge({
      matched: [
        { ground_truth_id: 'test-bug-one', matched_issue_description: 'desc' },
        {
          ground_truth_id: 'test-bug-one',
          matched_issue_description: 'same bug, described again',
        },
      ],
      missed_ground_truth_ids: ['test-bug-two'],
      false_positives: [],
      actionable_count: 1,
    });

    const scorecard = await runBenchmark(decide, judge, manager, {
      targetUrl: 'data:text/html,<input type="text" />',
      groundTruthPath: GROUND_TRUTH_FIXTURE,
    });

    expect(scorecard.recall).toBe(1);
    expect(scorecard.missed_ground_truth_ids).toEqual(['test-bug-two']);
    expect(scorecard.unreconciled_ids).toBeUndefined();
  }, 15_000);
});
