// G3.6, the part that is a time budget: it runs alone, like the other
// budgets, because a 200 ms bar means nothing while thirty test files share
// the machine (it measured 206 ms in CI that way, 30 ms on its own).
import { describe, expect } from 'vitest';
import type { Action } from './contract.js';
import { gate, useGauntlet, worstOf } from './harness.js';

describe('G3 failures', () => {
  const ctx = useGauntlet();

  describe('G3.6 speed of failures', () => {
    gate(
      'G3.6',
      'R-D2',
      'failures known without waiting return in under 200 ms, worst of 50',
      async () => {
        const s = await ctx.open('states');
        const disabled = await s.ref('submit');
        const button = await s.ref('dead');
        const immediate: Action[] = [
          { type: 'click', ref: 'e999999' },
          { type: 'click', ref: disabled },
          { type: 'fill', ref: button, text: 'x' },
          { type: 'click' } as unknown as Action,
          { type: 'dialog', accept: true },
        ];
        for (const action of immediate) {
          const worst = await worstOf(50, () => s.act(action));
          expect(worst, JSON.stringify(action)).toBeLessThan(200);
        }

        const dynamic = await ctx.open('dynamic');
        const old = await dynamic.ref('contact-ada');
        await dynamic.page.locator('[data-g=filter]').press('a');
        const worst = await worstOf(50, () =>
          dynamic.act({ type: 'click', ref: old }),
        );
        expect(worst, 'stale_ref').toBeLessThan(200);
      },
      120_000,
    );
  });
});
