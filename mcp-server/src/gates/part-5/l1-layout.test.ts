// The layout slice of part 5 (docs/v3/part-5-layout.md): layout defects
// raised as signals by geometry alone, and nothing raised on what only
// looks like one.
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type ExpectedLayout,
  loadLayoutTruth,
} from '../../test-support/gauntlet/layout-truth.js';
import {
  EVIDENCE_PAGES,
  GAUNTLET_PAGES,
  LAYOUT_PAGES,
  type LayoutPage,
  SIGNAL_PAGES,
  TESTER_PAGES,
  type Variant,
} from '../../test-support/gauntlet/server.js';
import type { Action } from '../part-1/contract.js';
import type { Signal } from '../part-2/contract.js';
import { type SignalSession, useSignals } from '../part-2/harness.js';
import { PASSING } from './status.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SPEC = resolve(HERE, '../../../../docs/v3/part-5-layout.md');
const TRUTH = loadLayoutTruth();

function gate(
  id: string,
  requirements: string,
  name: string,
  fn: () => Promise<void>,
  timeoutMs = 120_000,
): void {
  const run = PASSING.has(id) ? it : it.fails;
  run(`${id} [${requirements}] ${name}`, fn, timeoutMs);
}

// A layout signal, as the engine returns it beside part 2's kinds.
interface LayoutSignal {
  id: string;
  kind: string;
  rule: string;
  url: string;
  step: number;
  message: string;
  severity: 'major' | 'minor';
  count: number;
  name?: string;
}

const layoutOf = (signals: Signal[]): LayoutSignal[] =>
  (signals as unknown as LayoutSignal[]).filter((s) => s.kind === 'layout');

// Whether the signals are exactly the expected ones, each once.
function expectExactly(
  signals: LayoutSignal[],
  expected: ExpectedLayout[],
  label: string,
): void {
  const left = [...signals];
  const missing: ExpectedLayout[] = [];
  for (const one of expected) {
    const at = left.findIndex(
      (s) =>
        s.rule === one.rule &&
        s.severity === one.severity &&
        (one.name === undefined || s.name === one.name) &&
        (one.contains === undefined || s.message.includes(one.contains)),
    );
    if (at === -1) missing.push(one);
    else left.splice(at, 1);
  }
  expect({ missing, extra: left.map((s) => s.message) }, label).toEqual({
    missing: [],
    extra: [],
  });
}

const SABOTAGE_MODULE = '../../engine/sabotage.js';
async function sabotage(name: string | null): Promise<void> {
  const module = await import(/* @vite-ignore */ SABOTAGE_MODULE);
  module.setSabotage(name);
}

describe('L the layout slice of part 5', () => {
  const ctx = useSignals();
  const written: string[] = [];

  afterEach(async () => {
    await sabotage(null).catch(() => {});
    for (const path of written.splice(0)) rmSync(path, { force: true });
  });

  const open = (page: LayoutPage, variant: Variant) =>
    ctx.openUrl(ctx.gauntlet.url(page, `variant=${variant}`), {});

  // Plays a page's steps; returns the layout signals of the load and those
  // the steps brought.
  async function tour(page: LayoutPage, variant: Variant) {
    const session = await open(page, variant);
    const spawned = JSON.parse(ctx.transcript[ctx.transcript.length - 1]);
    const load = layoutOf(spawned.signals ?? []);
    const after: LayoutSignal[] = [];
    for (const step of TRUTH[page].steps) {
      const action: Action =
        step.type === 'resize'
          ? {
              type: 'resize',
              width: step.width ?? 375,
              height: step.height ?? 700,
            }
          : { type: 'click', ref: await session.ref(step.target ?? '') };
      const result = await session.act(action);
      expect(result.results[0]?.ok, JSON.stringify(step)).toBe(true);
      after.push(
        ...layoutOf((result as unknown as { signals: Signal[] }).signals),
      );
    }
    return { session, load, after };
  }

  describe('L1 each defect, and nothing beside it', () => {
    for (const page of LAYOUT_PAGES) {
      gate(
        'L1.1',
        'R-L1 R-L2 R-L3 R-L4 R-L5 R-L6',
        `${page} buggy: the planted defect is raised, once, with its control and its step`,
        async () => {
          const { load, after } = await tour(page, 'buggy');
          expectExactly(load, TRUTH[page].load, 'as the page loads');
          expectExactly(after, TRUTH[page].after, 'once its steps are played');
          for (const signal of load) expect(signal.step).toBe(0);
          for (const signal of after) {
            expect(signal.step).toBe(TRUTH[page].steps.length);
          }
          for (const signal of [...load, ...after]) {
            expect(signal.id).toMatch(/^s\d+$/);
            expect(signal.count).toBe(1);
            expect(signal.url).toMatch(/^https?:\/\/[^?#]+$/);
          }
        },
      );

      gate(
        'L1.2',
        'R-L7',
        `${page} clean: the same steps raise nothing, look-alikes included`,
        async () => {
          const { load, after } = await tour(page, 'clean');
          expect([...load, ...after].map((s) => s.message)).toEqual([]);
        },
      );
    }
  });

  describe('L2 silence everywhere else', () => {
    gate(
      'L2.1',
      'R-L7',
      'no other page of the gauntlet raises a layout signal as it loads, but the one that plants a cover',
      async () => {
        const raised: string[] = [];
        const pages = [
          ...GAUNTLET_PAGES.map((p) => [p, ''] as const),
          ...[...SIGNAL_PAGES, ...EVIDENCE_PAGES, ...TESTER_PAGES].flatMap(
            (p) =>
              [
                [p, 'variant=buggy'],
                [p, 'variant=clean'],
              ] as const,
          ),
        ];
        for (const [page, query] of pages) {
          await ctx.openUrl(ctx.gauntlet.url(page, query), {
            // Layout only: what else these pages raise is theirs to plant.
            replay_budget_ms: 0,
          });
          const spawned = JSON.parse(ctx.transcript[ctx.transcript.length - 1]);
          for (const signal of layoutOf(spawned.signals ?? [])) {
            raised.push(`${page}?${query}: ${signal.message}`);
          }
          await ctx.discard();
        }
        expect(raised).toEqual([]);
      },
      600_000,
    );

    gate(
      'L2.2',
      'R-L7',
      'the banner part 1 plants over a button is the one cover reported there',
      async () => {
        await ctx.openUrl(ctx.gauntlet.url('overlays', 'case=banner'), {});
        const spawned = JSON.parse(ctx.transcript[ctx.transcript.length - 1]);
        const found = layoutOf(spawned.signals ?? []);
        expect(found.map((s) => [s.rule, s.name])).toEqual([
          ['covered', 'Privacy policy'],
        ]);
        expect(found[0].message).toContain('Cookie consent');
        // The same page with a modal over everything: that is what a modal
        // is for.
        await ctx.openUrl(ctx.gauntlet.url('overlays', 'case=modal'), {});
        const modal = JSON.parse(ctx.transcript[ctx.transcript.length - 1]);
        expect(layoutOf(modal.signals ?? [])).toEqual([]);
        await ctx.discard();
      },
    );
  });

  describe('L3 where it goes', () => {
    const covered = async (): Promise<SignalSession> =>
      ctx.sig('lay-covered' as never, 'buggy');

    gate(
      'L3.1',
      'R-L8',
      'a defect is one signal however many actions follow, and is in the session’s result',
      async () => {
        const session = await covered();
        const first = layoutOf(session.atSpawn);
        expect(first).toHaveLength(1);
        // Actions that bring controls, so that the layout is read again: the
        // button is still covered, and is not reported again.
        for (const g of ['menu', 'menu', 'panel-open']) {
          const result = await session.click(g);
          expect(layoutOf(result.signals)).toEqual([]);
        }
        const ended = layoutOf(await session.end());
        expect(ended.map((s) => s.id)).toEqual(first.map((s) => s.id));
        expect(ended[0].count).toBe(1);
      },
    );

    gate(
      'L3.2',
      'R-L8',
      'the report lists it with what the engine detected, and a covered control fails a build',
      async () => {
        const session = await covered();
        const signals = await session.end();
        const result = await ctx.haunt.call<{
          report_path: string;
          markdown: string;
          signal_counts: { total: number; major: number };
          confirmed_major_signals: number;
        }>('haunt_generate_report', {
          target_url: ctx.gauntlet.url('lay-covered'),
          date: '2026-05-05',
          sessions: [
            {
              area: '/lay-covered',
              overall_impression: 'done',
              issues: [],
              signals,
            },
          ],
        });
        if (result.isError) throw new Error(result.text);
        written.push(
          result.data.report_path,
          result.data.report_path.replace(/\.md$/, '.json'),
        );
        const detected = result.data.markdown.split(
          '## Detected automatically',
        )[1];
        expect(detected).toContain('"Stop sharing" is covered');
        expect(result.data.signal_counts).toMatchObject({ total: 1, major: 1 });
        expect(result.data.confirmed_major_signals).toBe(1);
      },
    );
  });

  describe('L4 the gate is not lying', () => {
    gate(
      'L4.1',
      'R-L9',
      'with the layout left unread, the check of a planted defect fails',
      async () => {
        const check = async () => {
          const { load } = await tour('lay-covered', 'buggy');
          expectExactly(load, TRUTH['lay-covered'].load, 'as the page loads');
        };
        await check();
        await sabotage('layout_unread');
        let caught = false;
        try {
          await check();
        } catch {
          caught = true;
        }
        await ctx.discard();
        expect(caught, 'the gate did not notice').toBe(true);
      },
    );

    gate(
      'L4.2',
      'R-L9',
      'every requirement of the specification is claimed here, and no test is skipped',
      async () => {
        const source = readdirSync(HERE)
          .filter((f) => /^l\d.*\.test\.ts$/.test(f))
          .map((f) => readFileSync(join(HERE, f), 'utf-8'))
          .join('\n');
        const claimed = new Set(
          [...source.matchAll(/gate\(\s*'L\d+\.\d+',\s*'([^']+)'/g)].flatMap(
            (m) => m[1].split(/\s+/),
          ),
        );
        const required = [
          ...new Set(readFileSync(SPEC, 'utf-8').match(/\bR-L\d+\b/g)),
        ].sort();
        expect(required).toHaveLength(9);
        expect(required.filter((id) => !claimed.has(id))).toEqual([]);
        for (const marker of ['skip', 'only', 'todo', 'skipIf', 'runIf']) {
          expect(source.includes(`.${marker}(`), marker).toBe(false);
        }
      },
    );
  });
});
