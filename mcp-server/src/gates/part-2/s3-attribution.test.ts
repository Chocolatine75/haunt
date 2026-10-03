// S3 — attribution (R-S6 … R-S9).
//
// A signal belongs to the action that caused it, however late it shows.
// The page's defects that outlast an action are what makes this hard: an
// exception 2.5 s after its click, a response after 6.5 s.
import { describe, expect } from 'vitest';
import type { ExpectedSignal } from '../../test-support/gauntlet/ground-truth.js';
import type { SignalPage } from '../../test-support/gauntlet/server.js';
import {
  TOURED,
  TRUTH,
  expectExactly,
  fits,
  gate,
  pathOf,
  useSignals,
  useTours,
} from './harness.js';

function planted(page: SignalPage, control: string): ExpectedSignal {
  const trigger = TRUTH[page].triggers.find((t) => t.trigger === control);
  if (trigger?.signals.length !== 1) throw new Error(`no ${control}`);
  return trigger.signals[0];
}

describe('S3 attribution', () => {
  const ctx = useSignals();
  const tourOf = useTours(ctx);

  describe('S3.1 each signal carries the step that caused it', () => {
    for (const page of TOURED) {
      gate(
        'S3.1',
        'R-S6',
        `${page}: each control's signals carry its step, and the load's carry step 0`,
        async () => {
          const tour = await tourOf(page);
          const at = (step: number) =>
            tour.signals.filter((s) => s.step === step);

          expectExactly(at(0), tour.truth.load, `${page} load`);
          for (const trigger of tour.truth.triggers) {
            const step = tour.steps.get(trigger.trigger);
            if (step === undefined)
              throw new Error(`no step for ${trigger.trigger}`);
            expect(step).toBeGreaterThan(0);
            expectExactly(at(step), trigger.signals, trigger.trigger);
          }
          // Nothing is attributed to a step that only went back to the page
          // or waited.
          const clicked = new Set([0, ...tour.steps.values()]);
          expect(tour.signals.filter((s) => !clicked.has(s.step))).toEqual([]);
        },
        90_000,
      );
    }
  });

  describe('S3.2 an exception thrown after its click', () => {
    gate(
      'S3.2',
      'R-S6 R-S7',
      '800 ms after the click: attributed to it and delivered with its result',
      async () => {
        const session = await ctx.sig('sig-exceptions');
        const result = await session.click('throw-later');
        const mine = result.signals.filter((s) =>
          fits(s, planted('sig-exceptions', 'throw-later')),
        );
        expect(mine).toHaveLength(1);
        expect(mine[0].step).toBe(result.step);
        expect(mine[0].late).toBeUndefined();
      },
    );

    gate(
      'S3.2',
      'R-S6 R-S7',
      '2.5 s after the click, other actions in between: still attributed to it, delivered late, once',
      async () => {
        const session = await ctx.sig('sig-exceptions');
        const expected = planted('sig-exceptions', 'throw-after-settle');

        const first = await session.click('throw-after-settle');
        // The action came back before the exception: the page had settled.
        expect(first.signals.filter((s) => fits(s, expected))).toEqual([]);
        // Another control at once, with a signal of its own, then a wait
        // during which the exception is thrown.
        const second = await session.click('log-error');
        const third = await session.wait(3_000);
        expect(third.step).toBe(first.step + 2);

        const delivered = session.delivered.filter((s) => fits(s, expected));
        expect(delivered).toHaveLength(1);
        expect(delivered[0].step).toBe(first.step);
        expect(delivered[0].late).toBe(true);
        expect(session.deliveredBy.get(delivered[0].id)).toBeGreaterThan(1);

        // The second control's own signal is its own, and on time.
        const logged = second.signals.filter((s) =>
          fits(s, planted('sig-exceptions', 'log-error')),
        );
        expect(logged).toHaveLength(1);
        expect(logged[0].step).toBe(second.step);
        expect(logged[0].late).toBeUndefined();

        // The session's result has it once, with the same step.
        const ended = (await session.end()).filter((s) => fits(s, expected));
        expect(ended.map((s) => [s.id, s.step])).toEqual([
          [delivered[0].id, first.step],
        ]);
      },
    );
  });

  describe('S3.3 close actions', () => {
    gate(
      'S3.3',
      'R-S9',
      'two clicks in a row, each with its own failing request, 30 times: each signal goes to its own click',
      async () => {
        const session = await ctx.sig('sig-http');
        const orders = await session.s.ref('load-orders');
        const profile = await session.s.ref('load-profile');
        const pairs: Array<[number, number]> = [];

        for (let i = 0; i < 30; i++) {
          const result = await session.act(
            { type: 'click', ref: orders },
            { type: 'click', ref: profile },
          );
          expect(result.executed).toBe(2);
          pairs.push([result.step - 1, result.step]);
        }
        await session.end();

        const stepsOf = (path: string) =>
          session
            .all()
            .filter(
              (s) => s.kind === 'http_error' && pathOf(s.request_url) === path,
            )
            .map((s) => s.step)
            .sort((a, b) => a - b);
        expect(stepsOf('/sig/api/orders')).toEqual(pairs.map((p) => p[0]));
        expect(stepsOf('/sig/api/profile')).toEqual(pairs.map((p) => p[1]));
        // One request per click, so one occurrence per signal.
        expect(
          session.all().filter((s) => s.step > 0 && s.count !== 1),
        ).toEqual([]);
        // All sixty clicks happened.
        expect(
          ctx.gauntlet.requests.base.filter((r) => r === 'GET /sig/api/orders')
            .length,
        ).toBeGreaterThanOrEqual(30);
      },
      120_000,
    );
  });

  describe('S3.4 a response that outlasts its action', () => {
    gate(
      'S3.4',
      'R-S6 R-S7',
      'started by action 1 and finishing during action 3, it is attributed to step 1',
      async () => {
        const session = await ctx.sig('sig-network');
        const expected = planted('sig-network', 'outlast');

        const first = await session.click('outlast');
        // The action gave up waiting before the answer came.
        expect(first.results[0].settled).toBe(false);
        expect(first.signals.filter((s) => fits(s, expected))).toEqual([]);
        await session.act({ type: 'read' });
        const third = await session.wait(3_000);
        expect(third.step).toBe(first.step + 2);
        expect(await session.s.status()).toBe('Archive ready');

        const delivered = session.delivered.filter((s) => fits(s, expected));
        expect(delivered).toHaveLength(1);
        expect(delivered[0].step).toBe(first.step);
        expect(delivered[0].late).toBe(true);
      },
    );
  });

  describe('S3.5 after the last action', () => {
    gate(
      'S3.5',
      'R-S8',
      'an exception caused by the last action is in the session result',
      async () => {
        const session = await ctx.sig('sig-exceptions');
        const expected = planted('sig-exceptions', 'throw-after-settle');
        const last = await session.click('throw-after-settle');
        expect(last.signals.filter((s) => fits(s, expected))).toEqual([]);

        const ended = (await session.end()).filter((s) => fits(s, expected));
        expect(ended).toHaveLength(1);
        expect(ended[0].step).toBe(last.step);
      },
    );

    gate(
      'S3.5',
      'R-S8',
      'a request the last action left hanging is in the session result',
      async () => {
        // Hung one second after the action has stopped waiting for it.
        const session = await ctx.sig('sig-network', 'buggy', {
          signal_thresholds: { hung_request_ms: 6_000 },
        });
        const expected = planted('sig-network', 'hang');
        const last = await session.click('hang');
        expect(last.signals.filter((s) => s.kind === 'request_hung')).toEqual(
          [],
        );

        const ended = (await session.end()).filter((s) => fits(s, expected));
        expect(ended).toHaveLength(1);
        expect(ended[0].step).toBe(last.step);
        expect(
          ended[0].kind === 'request_hung' && ended[0].duration_ms,
        ).toBeGreaterThanOrEqual(6_000);
      },
    );

    gate(
      'S3.5',
      'R-S8',
      'ending a session waits no longer than the settle cap for what is still going on',
      async () => {
        const session = await ctx.sig('sig-network');
        await session.click('hang');
        const start = performance.now();
        await session.end();
        // The request never answers: the cap, and the time to close.
        expect(performance.now() - start).toBeLessThan(5_000 + 2_000);
      },
    );
  });
});
