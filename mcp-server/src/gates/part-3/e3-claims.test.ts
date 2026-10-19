// E3 — nothing on a model's word (R-E1, R-E9).
import { describe, expect } from 'vitest';
import { EVIDENCE_PAGES } from '../../test-support/gauntlet/server.js';
import { gate, useEvidence } from './harness.js';

const ISSUE = {
  severity: 'major' as const,
  category: 'ux' as const,
  description: 'Something is wrong',
  recommendation: 'Fix it',
};

describe('E3 nothing on a model’s word', () => {
  const ctx = useEvidence();

  describe('E3.1 no claim', () => {
    gate(
      'E3.1',
      'R-E1 R-E9',
      // Until part 4 it was rejected, with the reason `no_claim`. Part 4
      // keeps it for a person to look at (R-T11): what a tester saw and
      // could not state as a check was being lost. What this test holds is
      // what part 3 is about: nothing is confirmed on a model's word.
      'an issue with no signal and no observation is confirmed by nothing: it ends unchecked',
      async () => {
        const session = await ctx.ev('ev-sequence');
        await session.play();
        const ended = await session.end([{ ...ISSUE, page_url: session.url }]);
        expect(ended.rejected).toEqual([]);
        expect(
          ended.issues_found.map((i) => i.verification.status as string),
        ).toEqual(['unchecked']);
      },
    );
  });

  describe('E3.2 unknown signal', () => {
    gate(
      'E3.2',
      'R-E9',
      'an issue naming a signal the session does not have is rejected',
      async () => {
        const session = await ctx.ev('ev-sequence');
        await session.play();
        const ended = await session.end([
          { ...ISSUE, page_url: session.url, signal: 's999' },
        ]);
        expect(ended.issues_found).toEqual([]);
        expect(ended.rejected[0].verification).toMatchObject({
          status: 'rejected',
          reason: 'unknown_signal',
        });
      },
    );
  });

  describe('E3.3 false observation', () => {
    gate(
      'E3.3',
      'R-E1 R-E9',
      'an observation that never holds is rejected after its replays',
      async () => {
        const session = await ctx.ev('ev-silent');
        await session.play();
        const ended = await session.end([
          {
            ...ISSUE,
            page_url: session.url,
            observed: { text_present: 'Your order has shipped' },
          },
        ]);
        expect(ended.issues_found).toEqual([]);
        expect(ended.rejected[0].verification).toMatchObject({
          status: 'rejected',
          reason: 'not_reproduced',
          reproduced: 0,
        });
      },
    );
  });

  describe('E3.4 clean variants', () => {
    for (const page of EVIDENCE_PAGES.filter((p) => p !== 'ev-long')) {
      gate(
        'E3.4',
        'R-E9',
        `${page} clean: the ground truth's issues filed anyway are all rejected`,
        async () => {
          const session = await ctx.ev(page, 'clean');
          await session.play();
          const ended = await session.end();
          expect(ended.issues_found).toEqual([]);
          expect(ended.rejected).toHaveLength(session.truth.claims.length);
        },
      );
    }
  });
});
