// G6 — performance budgets (R-F1 … R-F4). Worst of 10 runs each.
import { describe, expect } from 'vitest';
import { REF_IN_TEXT, SNAPSHOT_CHAR_BUDGET } from './contract.js';
import { type Session, gate, useGauntlet, worstOf } from './harness.js';

// Total size of a text snapshot across all of its pages.
async function totalChars(s: Session, actionable_only: boolean) {
  const first = await s.capture({ format: 'text', actionable_only });
  let chars = first.text.length;
  let refs = [...first.text.matchAll(REF_IN_TEXT)].length;
  for (let page = 2; page <= (first.truncated?.pages ?? 1); page++) {
    const next = await s.capture({ format: 'text', actionable_only, page });
    expect(next.text.length).toBeLessThanOrEqual(SNAPSHOT_CHAR_BUDGET);
    chars += next.text.length;
    refs += [...next.text.matchAll(REF_IN_TEXT)].length;
  }
  return { chars, refs };
}

describe('G6 performance', () => {
  const ctx = useGauntlet();

  gate(
    'G6.1',
    'R-F1',
    'a snapshot of the 2,000-element page takes under 500 ms',
    async () => {
      const s = await ctx.open('huge');
      await s.snapshot(); // warm-up, not measured
      expect(await worstOf(10, () => s.snapshot())).toBeLessThan(500);
      expect(
        await worstOf(10, () => s.capture({ format: 'text' })),
      ).toBeLessThan(500);
    },
    60_000,
  );

  gate(
    'G6.2',
    'R-F2',
    'a simple action on a settled page takes under 300 ms, result included',
    async () => {
      const s = await ctx.open('editor');
      const ref = await s.ref('bold');
      await s.act({ type: 'click', ref }); // warm-up
      expect(
        await worstOf(10, () => s.act({ type: 'click', ref })),
      ).toBeLessThan(300);
      // All eleven really happened.
      expect(await s.clicks()).toHaveLength(11);
    },
    60_000,
  );

  gate(
    'G6.3',
    'R-F3',
    '50 actions in a row on the 2,000-element page take under 30 s',
    async () => {
      const s = await ctx.open('huge');
      const { elements } = await s.snapshot();
      const refOf = (g: string) => {
        const found = elements.find((e) => e.attributes?.['data-g'] === g);
        if (!found) throw new Error(`no ${g}`);
        return found.ref;
      };

      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        // Spread over the whole page, so most need scrolling into view.
        const record = 1 + ((i * 97) % 500);
        const result =
          i % 2 === 0
            ? await s.act({ type: 'click', ref: refOf(`archive-${record}`) })
            : await s.act({
                type: 'fill',
                ref: refOf(`note-${record}`),
                text: `note ${i}`,
              });
        expect(result.results[0].ok, `action ${i}`).toBe(true);
      }
      expect(performance.now() - start).toBeLessThan(30_000);
      expect((await s.state()).clicks).toBeGreaterThanOrEqual(25);
    },
    90_000,
  );

  gate(
    'G6.4',
    'R-F4',
    'every page of the snapshot fits the budget, and actionable-only is at most a third of the full one',
    async () => {
      const s = await ctx.open('huge');
      const full = await totalChars(s, false);
      const lean = await totalChars(s, true);
      // Same elements either way.
      expect(full.refs).toBe(2000);
      expect(lean.refs).toBe(2000);
      expect(lean.chars).toBeLessThanOrEqual(full.chars / 3);
    },
    60_000,
  );
});
