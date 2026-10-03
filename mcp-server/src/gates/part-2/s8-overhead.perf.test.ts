// S8.4 — what collecting signals costs (R-S25). Run with the other time
// budgets, alone on the machine: enforced by `npm run check`, reported in CI.
import { describe, expect } from 'vitest';
import { gate, useSignals } from './harness.js';

// The engine's test-only switch (see part 1's G7). `signals_off` runs a
// session exactly as part 1 did: nothing collected, nothing audited.
const SABOTAGE_MODULE = '../../engine/sabotage.js';
async function sabotage(name: string | null): Promise<void> {
  const module = await import(/* @vite-ignore */ SABOTAGE_MODULE);
  module.setSabotage(name);
}

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

describe('S8 the gate itself', () => {
  const ctx = useSignals();

  gate(
    'S8.4',
    'R-S25',
    'collecting signals adds no more than 10% to an action on the 2,000-element page',
    async () => {
      // Forty clicks spread over the page, timed as a caller sees them.
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
        // Interleaved, so that a machine slowing down weighs on both.
        const on: number[] = [];
        const off: number[] = [];
        for (let round = 0; round < 3; round++) {
          await sabotage('signals_off');
          off.push(await run());
          await sabotage(null);
          on.push(await run());
        }
        console.info(
          `median action: ${median(on).toFixed(1)} ms with signals, ${median(off).toFixed(1)} ms without`,
        );
        expect(median(on)).toBeLessThanOrEqual(median(off) * 1.1);
      } finally {
        await sabotage(null).catch(() => {});
      }
    },
    300_000,
  );
});
