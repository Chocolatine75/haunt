// E5 — storage (R-E16).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import {
  BUNDLE_CAP_BYTES,
  type CappedVerification,
  REPORT_CAP_BYTES,
  type StepsFile,
} from './contract.js';
import { gate, readJson, sizeOf, useEvidence } from './harness.js';

describe('E5 storage', () => {
  const ctx = useEvidence();

  describe('E5.1 a 200-step bundle', () => {
    gate(
      'E5.1',
      'R-E16',
      'ev-long’s bundle holds its 200 steps and stays under 5 MB',
      async () => {
        const session = await ctx.ev('ev-long');
        await session.play();
        const [issue] = (await session.end()).issues_found;
        const bundle = issue.verification.bundle as string;
        expect(
          readJson<StepsFile>(join(bundle, 'steps.json')).steps,
        ).toHaveLength(200);
        expect(sizeOf(bundle)).toBeLessThan(BUNDLE_CAP_BYTES);
      },
      600_000,
    );
  });

  describe('E5.2 the cap', () => {
    gate(
      'E5.2',
      'R-E16',
      'past the cap the trace is dropped and said so, and steps.json stays',
      async () => {
        const session = await ctx.ev('ev-sequence', 'buggy', {
          bundle_cap_bytes: 20_000,
        });
        await session.play();
        const [issue] = (await session.end()).issues_found;
        const bundle = issue.verification.bundle as string;
        expect(existsSync(join(bundle, 'trace.zip'))).toBe(false);
        expect(existsSync(join(bundle, 'steps.json'))).toBe(true);
        expect(existsSync(join(bundle, 'verification.json'))).toBe(true);
        expect(
          readJson<CappedVerification>(join(bundle, 'verification.json'))
            .dropped,
        ).toContain('trace');
        expect(sizeOf(bundle)).toBeLessThan(20_000);
        // And it still replays.
        expect((await ctx.replay({ bundle })).outcome).toBe('reproduced');
      },
    );

    gate(
      'E5.2',
      'R-E16',
      'the bundles of a report with several sessions stay under 50 MB',
      async () => {
        const bundles: string[] = [];
        for (const page of ['ev-sequence', 'ev-frames', 'ev-late'] as const) {
          const session = await ctx.ev(page);
          await session.play();
          for (const issue of (await session.end()).issues_found) {
            bundles.push(issue.verification.bundle as string);
          }
        }
        expect(bundles).toHaveLength(4);
        const total = bundles.reduce((sum, b) => sum + sizeOf(b), 0);
        expect(total).toBeLessThan(REPORT_CAP_BYTES);
        for (const bundle of bundles) {
          expect(sizeOf(bundle)).toBeLessThan(BUNDLE_CAP_BYTES);
        }
      },
    );
  });
});
