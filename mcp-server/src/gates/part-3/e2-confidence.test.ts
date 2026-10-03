// E2 — confidence (R-E8, R-E10, R-E11, R-E12).
import { describe, expect } from 'vitest';
import { gate, useEvidence } from './harness.js';

describe('E2 confidence', () => {
  const ctx = useEvidence();

  describe('E2.1 flaky', () => {
    gate(
      'E2.1',
      'R-E8 R-E12',
      'ev-flaky is reported as flaky at 2 in 10, not confirmed and not dropped',
      async () => {
        const session = await ctx.ev('ev-flaky');
        await session.play();
        const ended = await session.end();
        expect(ended.rejected).toEqual([]);
        const [issue] = ended.issues_found;
        expect(issue.verification).toMatchObject({
          status: 'flaky',
          attempts: 10,
          reproduced: 2,
          rate: 0.2,
        });
        expect(issue.verification.bundle).toBeTruthy();
      },
    );
  });

  describe('E2.2 confirmed', () => {
    gate(
      'E2.2',
      'R-E8',
      'a confirmed issue took exactly three replays',
      async () => {
        const session = await ctx.ev('ev-sequence');
        await session.play();
        const [issue] = (await session.end()).issues_found;
        expect(issue.verification).toMatchObject({
          status: 'confirmed',
          attempts: 3,
          reproduced: 3,
          rate: 1,
        });
      },
    );
  });

  describe('E2.3 late', () => {
    gate(
      'E2.3',
      'R-E5 R-E8',
      'the exception 2.5 s after the click is reproduced: the replay waits for it',
      async () => {
        const session = await ctx.ev('ev-late');
        await session.play();
        const [issue] = (await session.end()).issues_found;
        expect(issue.verification.status).toBe('confirmed');
      },
    );
  });

  describe('E2.4 time budget', () => {
    gate(
      'E2.4',
      'R-E11 R-E12',
      'with a budget of one second, issues are unverified, listed apart, and not counted',
      async () => {
        const session = await ctx.ev('ev-late', 'buggy', {
          replay_budget_ms: 1_000,
        });
        await session.play();
        const ended = await session.end();
        expect(ended.issues_found.map((i) => i.verification.status)).toEqual([
          'unverified',
        ]);
        // A signal no issue names is not confirmed either.
        for (const signal of ended.signals) {
          expect(signal.verification.status).not.toBe('confirmed');
        }
      },
    );
  });

  describe('E2.2 signals', () => {
    gate(
      'E2.2',
      'R-E10',
      'a signal no issue names is replayed too, and carries its verification',
      async () => {
        const session = await ctx.ev('ev-sequence');
        await session.play();
        // Filed without its issue: the signal stays on its own.
        const ended = await session.end([]);
        const failing = ended.signals.find((s) => s.kind === 'http_error');
        expect(failing?.verification).toMatchObject({
          status: 'confirmed',
          attempts: 3,
        });
      },
    );
  });
});
