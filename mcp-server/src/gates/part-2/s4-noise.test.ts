// S4 — nothing that did not happen (R-S11 … R-S14).
//
// A browser's event log is full of things that look like failures and are
// not, and of failures that appear in it twice. signals.test.ts proves each
// of these traps is real; here the engine has to see through them.
import { describe, expect } from 'vitest';
import { TRUTH, expectExactly, gate, pathOf, useSignals } from './harness.js';

// Every way the part 1 `escape` page tries to reach another origin.
const ESCAPES = [
  'link',
  'form-post',
  'fetch',
  'beacon',
  'image',
  'redirect',
  'window-open',
  'link-new-tab',
  'frame-fetch',
  'frame-link',
];

describe('S4 nothing that did not happen', () => {
  const ctx = useSignals();

  describe('S4.1 the sandbox is not the app', () => {
    for (const id of ESCAPES) {
      gate(
        'S4.1',
        'R-S11',
        `${id}: blocked by the sandbox, and no signal`,
        async () => {
          const session = await ctx.part1('escape');
          const before = ctx.gauntlet.requests.other.length;
          const result = await session.click(id);
          await session.wait(400);
          await session.end();

          // Blocked, and reported where blocks go.
          expect(ctx.gauntlet.requests.other.slice(before)).toEqual([]);
          expect([
            ...(result.sandbox_blocked ?? []),
            ...(session.ended?.sandbox_blocked_requests ?? []),
          ]).not.toEqual([]);
          // Neither the block, nor the console line the browser prints about
          // it, nor the page's own handling of it.
          expect(session.all()).toEqual([]);
        },
      );
    }
  });

  describe('S4.2 navigation is not failure', () => {
    gate(
      'S4.2',
      'R-S12',
      'a request the page cancels itself is not a signal',
      async () => {
        const session = await ctx.sig('sig-network');
        const result = await session.click('abort');
        expect(await session.s.status()).toBe('Search cancelled');
        await session.end();
        expect(session.all().filter((s) => s.step === result.step)).toEqual([]);
        expect(session.all()).toEqual([]);
      },
    );

    gate(
      'S4.2',
      'R-S12',
      'a request cut short by leaving the page is not a signal, however long one waits',
      async () => {
        // Hung after one second, so that the request the page abandoned
        // would be counted if it were still thought to be waiting.
        const session = await ctx.sig('sig-network', 'buggy', {
          signal_thresholds: { hung_request_ms: 1_000 },
        });
        const before = ctx.gauntlet.requests.base.length;
        await session.click('leave');
        expect(session.s.page.url()).toContain('left=1');
        expect(ctx.gauntlet.requests.base.slice(before)).toContain(
          'GET /sig/api/search',
        );
        await session.wait(2_000);
        await session.end();
        expect(session.all()).toEqual([]);
      },
    );

    gate('S4.2', 'R-S12', 'a download is not a signal', async () => {
      const session = await ctx.sig('sig-network');
      const result = await session.click('download');
      expect(result.results[0].changes.download?.filename).toBe('report.csv');
      await session.end();
      expect(session.all()).toEqual([]);
    });
  });

  describe('S4.3 one fact, one signal', () => {
    gate(
      'S4.3',
      'R-S13',
      'a 500 is one signal, not one for the response and one for the console line',
      async () => {
        const session = await ctx.sig('sig-http');
        const result = await session.click('load-orders');
        await session.end();
        const mine = session.all().filter((s) => s.step === result.step);
        expect(mine.map((s) => s.kind)).toEqual(['http_error']);
      },
    );

    gate(
      'S4.3',
      'R-S13',
      'a missing stylesheet is one signal, not a 404 and a failed request',
      async () => {
        const session = await ctx.sig('sig-http');
        expectExactly(session.atSpawn, TRUTH['sig-http'].load, 'load');
        expect(
          session.atSpawn.filter(
            (s) =>
              'request_url' in s &&
              pathOf(s.request_url) === '/sig/asset/theme.css',
          ),
        ).toHaveLength(1);
      },
    );

    gate(
      'S4.3',
      'R-S13',
      'a rejection the page also logs is one signal',
      async () => {
        const session = await ctx.sig('sig-exceptions');
        const result = await session.click('reject-logged');
        await session.end();
        const mine = session.all().filter((s) => s.step === result.step);
        expect(mine.map((s) => s.kind)).toEqual(['unhandled_rejection']);
      },
    );

    gate('S4.3', 'R-S13', 'a dropped connection is one signal', async () => {
      const session = await ctx.sig('sig-network');
      const result = await session.click('drop');
      await session.end();
      const mine = session.all().filter((s) => s.step === result.step);
      expect(mine.map((s) => s.kind)).toEqual(['request_failed']);
    });
  });

  describe('S4.4 repeats', () => {
    gate(
      'S4.4',
      'R-S13',
      'the same failing request made 20 times is one signal with count 20',
      async () => {
        const session = await ctx.sig('sig-http');
        const before = ctx.gauntlet.requests.base.length;
        const result = await session.click('refresh-prices');
        await session.end();
        // Twenty requests really went out.
        expect(
          ctx.gauntlet.requests.base
            .slice(before)
            .filter((r) => r === 'GET /sig/api/prices'),
        ).toHaveLength(20);

        const mine = session.all().filter((s) => s.step === result.step);
        expect(mine).toHaveLength(1);
        expect(mine[0].count).toBe(20);
      },
    );

    gate(
      'S4.4',
      'R-S13',
      'the same failure caused by two different clicks is two signals',
      async () => {
        const session = await ctx.sig('sig-http');
        const first = await session.click('load-orders');
        const second = await session.click('load-orders');
        await session.end();
        const orders = session
          .all()
          .filter(
            (s) =>
              s.kind === 'http_error' &&
              pathOf(s.request_url) === '/sig/api/orders',
          );
        expect(orders.map((s) => [s.step, s.count])).toEqual([
          [first.step, 1],
          [second.step, 1],
        ]);
        expect(new Set(orders.map((s) => s.id)).size).toBe(2);
      },
    );
  });

  describe('S4.5 expected statuses', () => {
    const whoami = async (spawn: Record<string, unknown>) => {
      const session = await ctx.sig('sig-http', 'buggy', spawn);
      const result = await session.click('whoami');
      await session.end();
      const mine = session.all().filter((s) => s.step === result.step);
      expect(mine).toHaveLength(1);
      if (mine[0].kind !== 'http_error') throw new Error('not an http_error');
      expect(mine[0].status).toBe(401);
      expect(mine[0].severity).toBe('minor');
      return mine[0];
    };

    gate(
      'S4.5',
      'R-S14',
      'a 401 while logged out is marked while_logged_out',
      async () => {
        expect((await whoami({})).while_logged_out).toBe(true);
      },
    );

    gate(
      'S4.5',
      'R-S14',
      'the same 401 with the session’s cookies is not',
      async () => {
        const signal = await whoami({
          cookies: [
            {
              name: 'gauntlet_session',
              value: 'signed-in',
              domain: '127.0.0.1',
              path: '/',
            },
          ],
        });
        expect('while_logged_out' in signal).toBe(false);
      },
    );
  });
});
