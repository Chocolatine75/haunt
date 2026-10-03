// S2 — clean is silent (R-S10).
//
// The clean variant of a signal page is the same page without its defects:
// the same controls, the same requests, the same timers. Whatever the engine
// reports there is something that did not happen.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect } from 'vitest';
import { GAUNTLET_PAGES } from '../../test-support/gauntlet/server.js';
import type { Signal } from './contract.js';
import { TOURED, gate, useSignals, useTours } from './harness.js';
import { PLANTED, unplanted } from './planted.js';

const label = (signal: Signal) =>
  signal.kind === 'a11y' ? `a11y:${signal.rule}` : signal.kind;

describe('S2 clean is silent', () => {
  const ctx = useSignals();
  const tourOf = useTours(ctx);

  describe('S2.1 the clean variants', () => {
    for (const page of TOURED) {
      gate(
        'S2.1',
        'R-S10',
        `${page} clean: the same clicks as on its buggy twin produce no signal`,
        async () => {
          const tour = await tourOf(page, 'clean');
          expect(tour.signals).toEqual([]);
          // Every control was really clicked, and the session really ended.
          expect(tour.results.size).toBe(tour.truth.triggers.length);
          expect([...tour.results.values()].every((r) => r.ok)).toBe(true);
          expect(tour.session.ended?.step_count).toBeGreaterThanOrEqual(
            tour.truth.triggers.length,
          );
        },
        90_000,
      );
    }

    gate(
      'S2.1',
      'R-S10',
      'sig-a11y clean: no signal when opened, none when audited again',
      async () => {
        const session = await ctx.sig('sig-a11y', 'clean');
        expect(session.atSpawn).toEqual([]);
        expect(await session.capture({ audit: true })).toEqual([]);
        expect(await session.end()).toEqual([]);
      },
    );
  });

  describe('S2.2 the pages of part 1, left alone', () => {
    for (const page of GAUNTLET_PAGES) {
      gate(
        'S2.2',
        'R-S10',
        `${page}: loaded and left alone for two seconds, only what it plants`,
        async () => {
          const session = await ctx.part1(page);
          await session.wait(2_000);
          await session.end();
          // Left alone: nothing was clicked, so no control can be dead.
          const planted = PLANTED[page].filter((p) => p !== 'dead_control');
          expect(session.all().map(label).sort()).toEqual([...planted].sort());
        },
      );
    }
  });

  describe('S2.3 the part 1 gate', () => {
    gate(
      'S2.3',
      'R-S10',
      'every session of the part 1 gate is checked for signals its page did not plant',
      async () => {
        // The check lives in part 1's harness, which every part 1 gate test
        // goes through; this proves it is wired and that it can fail.
        const harness = readFileSync(
          fileURLToPath(new URL('../part-1/harness.ts', import.meta.url)),
          'utf-8',
        );
        expect(harness).toContain('expectNoneUnplanted(await closeAll())');
        expect(harness).toContain('expectNoneUnplanted((result.data');

        // It reads the engine's own list, which therefore has to exist.
        const session = await ctx.part1('states');
        const engine = (
          session.s as unknown as { engineSession: { signals?: Signal[] } }
        ).engineSession;
        expect(Array.isArray(engine.signals)).toBe(true);

        // A planted signal passes, the same one on another page does not.
        const result = await session.click('dead');
        const dead = result.signals.filter((s) => s.kind === 'dead_control');
        expect(dead).toHaveLength(1);
        expect(engine.signals?.map((s) => s.id)).toContain(dead[0].id);
        expect(unplanted(dead)).toEqual([]);
        const elsewhere = { ...dead[0], url: ctx.gauntlet.url('dupes') };
        expect(unplanted([elsewhere])).toEqual([elsewhere]);
      },
    );
  });
});
