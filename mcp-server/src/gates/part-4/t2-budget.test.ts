// T2 — budget (R-T5, R-T6).
import { describe, expect } from 'vitest';
import type { Action } from '../part-1/contract.js';
import type { ActTesterResult } from './contract.js';
import { type TesterSession, gate, useTester } from './harness.js';

describe('T2 budget', () => {
  const ctx = useTester();

  // One action a call, each of which changes the page: the box is checked,
  // then unchecked.
  async function spend(
    session: TesterSession,
    count: number,
  ): Promise<ActTesterResult[]> {
    const ref = await session.ref('titles-only');
    const results: ActTesterResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(
        await session.act([{ type: 'check', ref, checked: i % 2 === 0 }]),
      );
    }
    return results;
  }

  gate(
    'T2.1',
    'R-T5',
    'with a budget of 8, the eighth action leaves 0, the ninth is refused, and reading, planning and ending still work',
    async () => {
      const session = await ctx.qa('qa-search', 'buggy', { budget: 8 });
      const results = await spend(session, 8);
      expect(results.map((r) => r.steps_remaining)).toEqual([
        7, 6, 5, 4, 3, 2, 1, 0,
      ]);

      const action: Action = {
        type: 'check',
        ref: await session.ref('titles-only'),
        checked: true,
      };
      const ninth = await ctx.haunt.call('haunt_act', {
        session_id: session.id,
        actions: [action],
      });
      expect(ninth.isError).toBe(true);
      expect(ninth.text).toContain('haunt_end_session');

      expect((await session.s.capture()).text).toContain('Titles only');
      expect((await session.plan()).coverage.controls.exercised).toBe(1);
      expect((await session.end()).coverage.controls.exercised).toBe(1);
    },
  );

  gate(
    'T2.1b',
    'R-T5',
    'a session spawned with no budget has 40 actions',
    async () => {
      const session = await ctx.qa('qa-search', 'buggy', {
        timeout: undefined,
      });
      const [first] = await spend(session, 1);
      expect(first.steps_remaining).toBe(39);
    },
  );

  gate(
    'T2.2',
    'R-T6',
    'from three quarters of the budget the result lists what is untouched, and not before',
    async () => {
      const session = await ctx.qa('qa-search', 'buggy', { budget: 8 });
      await session.register();
      const results = await spend(session, 6);
      for (const early of results.slice(0, 5)) {
        expect('remaining' in early).toBe(false);
      }
      expect(results[5].remaining).toEqual({
        controls: [
          {
            ref: await session.ref('query'),
            role: 'searchbox',
            name: 'Search recipes',
          },
          { ref: await session.ref('clear'), role: 'button', name: 'Clear' },
        ],
        cases: ['titles-only'],
      });
    },
  );
});
