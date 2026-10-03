// E1 — every issue replays (R-E1 … R-E6, R-E13, R-E14).
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { EVIDENCE_PAGES } from '../../test-support/gauntlet/server.js';
import {
  BUNDLE_FILES,
  type StepsFile,
  type VerifiedIssue,
} from './contract.js';
import {
  EVIDENCE,
  type EvidenceSession,
  fitsClaim,
  gate,
  readJson,
  useEvidence,
} from './harness.js';

// Pages whose failure a replay can reach without a secret, and which do
// not fail only sometimes.
const PLAIN = EVIDENCE_PAGES.filter(
  (page) =>
    page !== 'ev-login' &&
    page !== 'ev-long' &&
    EVIDENCE[page].status === 'confirmed',
);

const bundleOf = (issue: VerifiedIssue): string => {
  const bundle = issue.verification.bundle;
  if (!bundle) throw new Error(`no bundle for ${issue.description}`);
  return bundle;
};

describe('E1 every issue replays', () => {
  const ctx = useEvidence();

  async function filed(session: EvidenceSession) {
    await session.play();
    const ended = await session.end();
    expect(ended.rejected).toEqual([]);
    expect(ended.issues_found).toHaveLength(session.truth.claims.length);
    return ended.issues_found;
  }

  describe('E1.1 a bundle replays on its own', () => {
    for (const page of PLAIN) {
      gate(
        'E1.1',
        'R-E1 R-E2 R-E3 R-E5 R-E13 R-E14',
        `${page}: each issue is confirmed, and its bundle alone reproduces it in a new server`,
        async () => {
          const session = await ctx.ev(page);
          const issues = await filed(session);
          for (const [i, issue] of issues.entries()) {
            expect(issue.verification.status).toBe('confirmed');
            const bundle = bundleOf(issue);
            for (const file of BUNDLE_FILES) {
              expect(existsSync(join(bundle, file)), `${page} ${file}`).toBe(
                true,
              );
            }
            const replay = await ctx.replay({ bundle });
            expect(replay.outcome, page).toBe('reproduced');
            const claim = session.truth.claims[i];
            if ('signal' in claim) {
              expect(
                replay.signal && fitsClaim(replay.signal, claim.signal),
              ).toBe(true);
            }
          }
        },
      );
    }
  });

  describe('E1.2 steps name no reference', () => {
    gate(
      'E1.2',
      'R-E4',
      'steps.json carries a locator for every reference, and no reference',
      async () => {
        const session = await ctx.ev('ev-sequence');
        const [issue] = await filed(session);
        const steps = readJson<StepsFile>(join(bundleOf(issue), 'steps.json'));
        expect(steps.version).toBe(1);
        expect(steps.steps).toHaveLength(3);
        for (const step of steps.steps) {
          expect(JSON.stringify(step.action)).not.toMatch(/"e\d+"/);
          expect(step.locators.ref?.role, JSON.stringify(step)).toBeTruthy();
        }
        // A server that has issued no reference at all replays it.
        expect((await ctx.replay({ bundle: bundleOf(issue) })).outcome).toBe(
          'reproduced',
        );
      },
    );
  });

  describe('E1.3 order matters', () => {
    gate(
      'E1.3',
      'R-E4 R-E5',
      'ev-sequence replays its three steps in order, and two of them do not reproduce it',
      async () => {
        const session = await ctx.ev('ev-sequence');
        const [issue] = await filed(session);
        const path = join(bundleOf(issue), 'steps.json');
        const steps = readJson<StepsFile>(path);
        expect(steps.steps.map((s) => s.action.type)).toEqual([
          'fill',
          'select',
          'click',
        ]);
        for (const skip of [0, 1]) {
          const dir = mkdtempSync(join(tmpdir(), 'haunt-e13-'));
          const fewer = {
            ...steps,
            steps: steps.steps.filter((_, i) => i !== skip),
          };
          writeFileSync(join(dir, 'steps.json'), JSON.stringify(fewer));
          const replay = await ctx.replay({ bundle: join(dir, 'steps.json') });
          expect(replay.outcome, `without step ${skip + 1}`).toBe(
            'not_reproduced',
          );
        }
      },
    );
  });

  describe('E1.4 frames and shadow roots', () => {
    gate(
      'E1.4',
      'R-E4',
      'the controls inside a frame and an open shadow root are found again',
      async () => {
        const session = await ctx.ev('ev-frames');
        const issues = await filed(session);
        for (const issue of issues) {
          const steps = readJson<StepsFile>(
            join(bundleOf(issue), 'steps.json'),
          );
          expect(
            steps.steps.some((s) => s.locators.ref?.path.length),
            issue.description,
          ).toBe(true);
          expect((await ctx.replay({ bundle: bundleOf(issue) })).outcome).toBe(
            'reproduced',
          );
        }
      },
    );
  });

  describe('E1.5 failed actions are left out', () => {
    gate(
      'E1.5',
      'R-E6',
      'an action that failed in the session is not among the steps',
      async () => {
        const session = await ctx.ev('ev-sequence');
        // Clicking an element that does not exist fails, and changes nothing.
        const failed = await session.s.act({ type: 'click', ref: 'e9999' });
        expect(failed.results[0].ok).toBe(false);
        const [issue] = await filed(session);
        const steps = readJson<StepsFile>(join(bundleOf(issue), 'steps.json'));
        expect(steps.steps.map((s) => s.step)).not.toContain(failed.step);
        expect(steps.steps).toHaveLength(3);
      },
    );
  });
});
