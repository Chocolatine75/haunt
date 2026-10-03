// S1 — every kind is detected, exactly (R-S1 … R-S5).
//
// Each buggy signal page is toured once: every control of its ground truth
// clicked in one session, the slowest defect waited out, the session ended.
// What the session produced is then compared with the ground truth, which
// signals.test.ts has checked against the browser itself.
import { describe, expect } from 'vitest';
import type { Signal } from './contract.js';
import {
  PERSONA,
  TOURED,
  TRUTH,
  compare,
  expectExactly,
  expectWellFormed,
  expectedOfTour,
  fits,
  gate,
  pathOf,
  useSignals,
  useTours,
} from './harness.js';

// The fields each kind must carry beyond the common ones (R-S2).
function expectKindFields(signal: Signal): void {
  const text = (value: unknown, what: string) =>
    expect(
      typeof value === 'string' && value.length > 0,
      `${signal.kind}.${what}`,
    ).toBe(true);
  const duration = (value: unknown) =>
    expect(
      typeof value === 'number' && value > 0,
      `${signal.kind}.duration_ms`,
    ).toBe(true);

  switch (signal.kind) {
    case 'http_error':
      text(signal.method, 'method');
      text(signal.request_url, 'request_url');
      text(signal.resource_type, 'resource_type');
      expect(signal.status).toBeGreaterThanOrEqual(400);
      break;
    case 'request_failed':
      text(signal.method, 'method');
      text(signal.request_url, 'request_url');
      expect(signal.error, 'the browser’s error').toMatch(/^net::ERR_/);
      break;
    case 'request_hung':
    case 'slow_response':
      text(signal.method, 'method');
      text(signal.request_url, 'request_url');
      duration(signal.duration_ms);
      break;
    case 'js_exception':
      text(signal.stack, 'stack');
      text(signal.source?.url, 'source.url');
      expect(signal.source.line, 'source.line').toBeGreaterThan(0);
      break;
    case 'unhandled_rejection':
      text(signal.stack, 'stack');
      break;
    case 'long_task':
      duration(signal.duration_ms);
      break;
    case 'dead_control':
      expect(signal.ref, 'ref').toMatch(/^e\d+$/);
      text(signal.role, 'role');
      text(signal.name, 'name');
      break;
    case 'a11y':
      text(signal.rule, 'rule');
      text(signal.help, 'help');
      expect(signal.nodes, 'nodes').toBeGreaterThanOrEqual(1);
      expect(Array.isArray(signal.refs), 'refs').toBe(true);
      break;
    case 'console_error':
      break;
  }
}

describe('S1 every kind is detected, exactly', () => {
  const ctx = useSignals();
  const tourOf = useTours(ctx);

  describe('S1.1 each planted defect is the signal the ground truth lists', () => {
    for (const page of TOURED) {
      gate(
        'S1.1',
        'R-S1 R-S2 R-S3',
        `${page}: every planted defect is reported, with its kind, its fields and its default severity`,
        async () => {
          const tour = await tourOf(page);
          const { missing } = compare(tour.signals, expectedOfTour(tour.truth));
          expect(missing).toEqual([]);

          for (const signal of tour.signals) {
            expectWellFormed(signal);
            expectKindFields(signal);
            // It happened on a page of the app under test.
            expect(new URL(signal.url).origin).toBe(ctx.gauntlet.baseUrl);
          }
          // The page did what the ground truth says it does: every control
          // was really clicked.
          expect([...tour.results.values()].every((r) => r.ok)).toBe(true);
          expect(tour.results.size).toBe(tour.truth.triggers.length);
        },
        90_000,
      );
    }

    gate(
      'S1.1',
      'R-S1 R-S2 R-S3',
      'sig-a11y: the twelve violations are reported when the page is opened',
      async () => {
        const session = await ctx.sig('sig-a11y');
        const { missing } = compare(session.atSpawn, TRUTH['sig-a11y'].load);
        expect(missing).toEqual([]);
        for (const signal of session.atSpawn) {
          expectWellFormed(signal);
          expectKindFields(signal);
          expect(pathOf(signal.url)).toBe('/sig-a11y');
        }
      },
    );

    gate(
      'S1.1',
      'R-S3',
      'no signal is ever critical',
      async () => {
        for (const page of TOURED) {
          const { signals } = await tourOf(page);
          expect(signals.length).toBeGreaterThan(0);
          expect(signals.map((s) => s.severity as string)).not.toContain(
            'critical',
          );
        }
      },
      240_000,
    );
  });

  describe('S1.2 nothing extra', () => {
    for (const page of TOURED) {
      gate(
        'S1.2',
        'R-S1 R-S10',
        `${page}: the session produces the signals of the ground truth and no other`,
        async () => {
          const tour = await tourOf(page);
          const expected = expectedOfTour(tour.truth);
          expectExactly(tour.signals, expected, page);
          expect(tour.signals).toHaveLength(expected.length);
        },
        90_000,
      );
    }

    gate(
      'S1.2',
      'R-S1 R-S10',
      'sig-a11y: twelve signals and no other, for a page nobody touched',
      async () => {
        const session = await ctx.sig('sig-a11y');
        await session.wait(500);
        await session.end();
        expectExactly(session.all(), TRUTH['sig-a11y'].load, 'sig-a11y');
      },
    );
  });

  describe('S1.3 thresholds', () => {
    const CASES = [
      ['sig-blocking', 'block-120', 'long_task', { long_task_ms: 100 }],
      ['sig-network', 'slowish', 'slow_response', { slow_response_ms: 1_000 }],
    ] as const;

    for (const [page, control, kind, lowered] of CASES) {
      const trigger = TRUTH[page].triggers.find((t) => t.trigger === control);
      if (!trigger?.under_threshold) throw new Error(`no ${control}`);
      const under = trigger.under_threshold;

      gate(
        'S1.3',
        'R-S4',
        `${control}: under the default threshold it is not a signal`,
        async () => {
          const session = await ctx.sig(page);
          const step = await session.trigger(trigger);
          await session.end();
          expect(session.all().filter((s) => s.step === step)).toEqual([]);
          expect(session.all().filter((s) => s.kind === kind)).toEqual([]);
        },
      );

      gate(
        'S1.3',
        'R-S4',
        `${control}: with the threshold lowered at spawn, it is one`,
        async () => {
          const session = await ctx.sig(page, 'buggy', {
            signal_thresholds: lowered,
          });
          const step = await session.trigger(trigger);
          await session.end();
          expectExactly(
            session.all().filter((s) => s.step === step),
            under,
            control,
          );
        },
      );
    }

    gate(
      'S1.3',
      'R-S4',
      'a threshold that is not a positive number is refused at spawn',
      async () => {
        for (const bad of [-1, 0, 'fast']) {
          const result = await ctx.haunt.call('haunt_spawn', {
            persona: PERSONA,
            target_url: ctx.gauntlet.url('sig-blocking'),
            signal_thresholds: { long_task_ms: bad },
          });
          expect(result.isError, String(bad)).toBe(true);
          expect(result.text).toContain('long_task_ms');
        }
      },
    );
  });

  describe('S1.4 a silent failure and a handled one', () => {
    gate(
      'S1.4',
      'R-S5',
      'the two failed saves of sig-silent differ only by feedback',
      async () => {
        const tour = await tourOf('sig-silent');
        const silent = tour.signals.find(
          (s) => s.step === tour.steps.get('save-silent'),
        );
        const loud = tour.signals.find(
          (s) => s.step === tour.steps.get('save-loud'),
        );
        if (silent?.kind !== 'http_error' || loud?.kind !== 'http_error') {
          throw new Error('no http_error for one of the two saves');
        }
        expect(silent.feedback).toBe(false);
        expect(loud.feedback).toBe(true);

        const { id: _a, step: _b, feedback: _c, ...rest } = silent;
        const { id: _d, step: _e, feedback: _f, ...other } = loud;
        expect(rest).toEqual(other);

        // The page agrees: nothing was shown for the first, a message for
        // the second.
        const [first, second] = ['save-silent', 'save-loud'].map(
          (id) => tour.results.get(id)?.changes,
        );
        expect(first?.dom_changed).toBe(false);
        expect(second?.dom_changed).toBe(true);
      },
      60_000,
    );

    gate(
      'S1.4',
      'R-S5',
      'a signal of the initial load says nothing about feedback',
      async () => {
        const session = await ctx.sig('sig-http');
        expect(session.atSpawn.length).toBeGreaterThan(0);
        for (const signal of session.atSpawn) {
          expect('feedback' in signal, signal.message).toBe(false);
        }
      },
    );
  });

  describe('S1.5 dead controls', () => {
    gate(
      'S1.5',
      'R-S2',
      'the three dead controls are reported with their reference, and none of the working ones is',
      async () => {
        const { triggers } = TRUTH['sig-dead'];
        const session = await ctx.sig('sig-dead');
        const refs = new Map<string, string>();
        const steps = new Map<string, number>();

        for (const trigger of triggers) {
          const ref = await session.s.ref(trigger.trigger);
          refs.set(trigger.trigger, ref);
          const result = await session.act({ type: 'click', ref });
          expect(result.results[0].ok, trigger.trigger).toBe(true);
          steps.set(trigger.trigger, result.step);
          // The page's own account of the click.
          if (trigger.signals.length > 0) {
            expect(result.results[0].changes.dom_changed).toBe(false);
          }
          if (trigger.effect === 'focus') {
            expect(
              await session.s.dom('search', 'el === document.activeElement'),
            ).toBe(true);
          }
          if (trigger.effect === 'scroll') {
            expect(
              await session.s.page.evaluate(
                () => document.getElementById('log')?.scrollTop,
              ),
            ).toBeGreaterThan(0);
          }
          if (trigger.navigates) {
            await session.act({
              type: 'goto',
              url: ctx.gauntlet.url('sig-dead', 'variant=buggy'),
            });
          }
        }
        await session.end();

        const dead = session.all().filter((s) => s.kind === 'dead_control');
        expect(dead).toHaveLength(3);
        for (const trigger of triggers) {
          const mine = dead.filter(
            (s) => s.step === steps.get(trigger.trigger),
          );
          if (trigger.signals.length === 0) {
            expect(mine, `${trigger.trigger} works`).toEqual([]);
            continue;
          }
          expect(mine, trigger.trigger).toHaveLength(1);
          expect(fits(mine[0], trigger.signals[0]), trigger.trigger).toBe(true);
          expect(mine[0].kind === 'dead_control' && mine[0].ref).toBe(
            refs.get(trigger.trigger),
          );
        }
      },
      60_000,
    );

    gate(
      'S1.5',
      'R-S2',
      'a control whose click throws or sends a request is not dead',
      async () => {
        // Each changes nothing on the page and is still not "wired to
        // nothing": what it caused is the signal.
        const CASES = [
          ['sig-exceptions', 'throw-now'],
          ['sig-exceptions', 'reject'],
          ['sig-exceptions', 'log-error'],
          ['sig-silent', 'save-silent'],
        ] as const;
        for (const [page, control] of CASES) {
          const session = await ctx.sig(page);
          const result = await session.click(control);
          expect(result.results[0].changes.dom_changed, control).toBe(false);
          await session.end();
          const mine = session.all().filter((s) => s.step === result.step);
          expect(
            mine.map((s) => s.kind),
            control,
          ).not.toContain('dead_control');
          expect(mine, control).toHaveLength(1);
        }
      },
      60_000,
    );
  });
});
