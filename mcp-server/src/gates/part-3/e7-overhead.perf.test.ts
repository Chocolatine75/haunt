// E7.4 — what recording the steps costs (R-E20). Run with the other time
// budgets, alone on the machine: enforced by `npm run check`, reported in CI.
import { describe, expect } from 'vitest';
import { gate, useEvidence } from './harness.js';

// The engine's test-only switch. `evidence_off` runs a session as part 2
// did: nothing recorded.
const SABOTAGE_MODULE = '../../engine/sabotage.js';
async function sabotage(name: string | null): Promise<void> {
  const module = await import(/* @vite-ignore */ SABOTAGE_MODULE);
  module.setSabotage(name);
}

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

describe('E7 the gate itself', () => {
  const ctx = useEvidence();

  gate(
    'E7.4',
    'R-E20',
    'recording the steps adds no more than 5% to an action on the 2,000-element page',
    async () => {
      const run = async () => {
        const session = await ctx.part1('huge');
        const { elements } = await session.s.snapshot();
        const refs = elements
          .filter((e) => e.attributes?.['data-g']?.startsWith('archive-'))
          .map((e) => e.ref);
        expect(refs.length).toBeGreaterThan(400);
        const times: number[] = [];
        for (let i = 0; i < 40; i++) {
          await session.s.act({
            type: 'click',
            ref: refs[(i * 97) % refs.length],
          });
          times.push(session.s.lastActMs);
        }
        await ctx.discard();
        return median(times);
      };

      try {
        await sabotage(null);
        await run(); // warm-up, not measured
        const on: number[] = [];
        const off: number[] = [];
        for (let round = 0; round < 3; round++) {
          await sabotage('evidence_off');
          off.push(await run());
          await sabotage(null);
          on.push(await run());
        }
        console.info(
          `median action: ${median(on).toFixed(1)} ms recorded, ${median(off).toFixed(1)} ms not`,
        );
        expect(median(on)).toBeLessThanOrEqual(median(off) * 1.05);
      } finally {
        await sabotage(null).catch(() => {});
      }
    },
    300_000,
  );
});
