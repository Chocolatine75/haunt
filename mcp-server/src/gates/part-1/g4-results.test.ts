// G4 — results tell the truth (R-C1 … R-C6, R-B5, R-B6).
import { describe, expect } from 'vitest';
import type { GauntletPage } from '../../test-support/gauntlet/server.js';
import { type Action, type ActionChanges, SETTLE_CAP_MS } from './contract.js';
import { type Session, gate, useGauntlet } from './harness.js';

interface Effect {
  name: string;
  page: GauntletPage;
  // Runs before the measured action, through the tools.
  before?: (s: Session) => Promise<unknown>;
  action: (s: Session) => Promise<Action>;
  expected: Partial<ActionChanges>;
  urlAfter?: RegExp;
}

// Actions whose effect on the page is known in advance.
const EFFECTS: Effect[] = [
  {
    name: 'a button that removes a row changes the page',
    page: 'dupes',
    action: async (s) => ({ type: 'click', ref: await s.ref('delete-1') }),
    expected: {
      navigated: false,
      dom_changed: true,
      none: false,
      tabs_opened: [],
    },
  },
  {
    name: 'a hash link changes the URL without a new tab',
    page: 'dupes',
    action: async (s) => ({ type: 'click', ref: await s.ref('more-release') }),
    expected: { navigated: true, tabs_opened: [], none: false },
    urlAfter: /#release$/,
  },
  {
    name: 'an ordinary link navigates',
    page: 'tabs',
    action: async (s) => ({ type: 'click', ref: await s.ref('same-tab-link') }),
    expected: { navigated: true, none: false },
    urlAfter: /\/tabs\/child\?from=same$/,
  },
  {
    name: 'a target=_blank link opens a tab and leaves the URL alone',
    page: 'tabs',
    action: async (s) => ({ type: 'click', ref: await s.ref('blank-link') }),
    expected: { navigated: false, tabs_opened: [1], none: false },
  },
  {
    name: 'window.open opens a tab',
    page: 'tabs',
    action: async (s) => ({ type: 'click', ref: await s.ref('open-button') }),
    expected: { tabs_opened: [1], none: false },
  },
  {
    name: 'a download link starts a download and names the file',
    page: 'tabs',
    action: async (s) => ({ type: 'click', ref: await s.ref('download-link') }),
    expected: {
      download: { filename: 'report.csv' },
      navigated: false,
      none: false,
    },
  },
  {
    name: 'an alert is reported',
    page: 'dialogs',
    action: async (s) => ({ type: 'click', ref: await s.ref('alert') }),
    expected: {
      dialog: { type: 'alert', message: 'Maintenance tonight at 22:00' },
      none: false,
    },
  },
  {
    name: 'answering a dialog lets the page react',
    page: 'dialogs',
    before: async (s) => s.act({ type: 'click', ref: await s.ref('confirm') }),
    action: async () => ({ type: 'dialog', accept: true }),
    expected: { dom_changed: true, none: false },
  },
  {
    name: 'clicking into a field moves focus and nothing else',
    page: 'forms',
    action: async (s) => ({ type: 'click', ref: await s.ref('text') }),
    expected: {
      focus_moved: true,
      navigated: false,
      dom_changed: false,
      none: true,
    },
  },
  {
    name: 'filling a field changes the page',
    page: 'forms',
    action: async (s) => ({
      type: 'fill',
      ref: await s.ref('text'),
      text: 'Ada',
    }),
    expected: { dom_changed: true, none: false },
  },
  {
    name: 'ticking a checkbox changes the page',
    page: 'forms',
    action: async (s) => ({
      type: 'check',
      ref: await s.ref('terms'),
      checked: true,
    }),
    expected: { dom_changed: true, none: false },
  },
  {
    name: 'choosing an option changes the page',
    page: 'selects',
    action: async (s) => ({
      type: 'select',
      ref: await s.ref('native-single'),
      values: ['Apple'],
    }),
    expected: { dom_changed: true, none: false },
  },
  {
    name: 'Enter in a form submits it',
    page: 'dupes',
    before: async (s) =>
      s.act({ type: 'fill', ref: await s.ref('login-email'), text: 'a@b.co' }),
    action: async (s) => ({
      type: 'press',
      ref: await s.ref('login-email'),
      keys: 'Enter',
    }),
    expected: { dom_changed: true, navigated: false, none: false },
  },
  {
    name: 'a client-side route change counts as navigation',
    page: 'spa',
    action: async (s) => ({ type: 'click', ref: await s.ref('nav-profile') }),
    expected: { navigated: true, dom_changed: true, none: false },
    urlAfter: /\/spa\/profile$/,
  },
  {
    name: 'goto navigates',
    page: 'forms',
    action: async (s) => ({ type: 'goto', url: s.gauntlet.url('dupes') }),
    expected: { navigated: true, none: false },
    urlAfter: /\/dupes$/,
  },
  {
    name: 'back navigates',
    page: 'forms',
    before: async (s) => s.act({ type: 'goto', url: s.gauntlet.url('dupes') }),
    action: async () => ({ type: 'back' }),
    expected: { navigated: true, none: false },
    urlAfter: /\/forms$/,
  },
  {
    name: 'reload navigates even though the URL is the same',
    page: 'forms',
    action: async () => ({ type: 'reload' }),
    expected: { navigated: true, none: false },
    urlAfter: /\/forms$/,
  },
  {
    name: 'hovering a menu reveals its children',
    page: 'hover',
    action: async (s) => ({ type: 'hover', ref: await s.ref('menu-products') }),
    expected: { dom_changed: true, navigated: false, none: false },
  },
  {
    name: 'a button replaced by its twin changes the page',
    page: 'dynamic',
    action: async (s) => ({ type: 'click', ref: await s.ref('swap') }),
    expected: { dom_changed: true, none: false },
  },
  {
    name: 'a toggle button changes state',
    page: 'editor',
    action: async (s) => ({ type: 'click', ref: await s.ref('bold') }),
    expected: { dom_changed: true, none: false },
  },
  {
    name: 'dragging a card changes the page',
    page: 'dnd',
    action: async (s) => ({
      type: 'drag',
      from_ref: await s.ref('card-1'),
      to_ref: await s.ref('column-done'),
    }),
    expected: { dom_changed: true, none: false },
  },
  {
    name: 'opening a new tab is reported by the tab action',
    page: 'tabs',
    action: async (s) => ({
      type: 'tab',
      op: 'new',
      url: s.gauntlet.url('dupes'),
    }),
    expected: { tabs_opened: [1], none: false },
  },
  {
    name: 'closing a tab is reported',
    page: 'tabs',
    before: async (s) =>
      s.act({ type: 'tab', op: 'new', url: s.gauntlet.url('dupes') }),
    action: async () => ({ type: 'tab', op: 'close', index: 1 }),
    expected: { tabs_closed: [1], none: false },
  },
  {
    name: 'a button wired to nothing changes nothing',
    page: 'states',
    action: async (s) => ({ type: 'click', ref: await s.ref('dead') }),
    expected: {
      navigated: false,
      dom_changed: false,
      tabs_opened: [],
      none: true,
    },
  },
  {
    name: 'a menu entry with no handler changes nothing',
    page: 'hover',
    action: async (s) => ({ type: 'click', ref: await s.ref('menu-about') }),
    expected: { navigated: false, dom_changed: false, none: true },
  },
];

describe('G4 results', () => {
  const ctx = useGauntlet();

  describe('G4.1 reported changes equal observed changes', () => {
    for (const effect of EFFECTS) {
      gate('G4.1', 'R-C1 R-C2', effect.name, async () => {
        const s = await ctx.open(effect.page);
        await effect.before?.(s);
        const before = s.pages.at(-1)?.url();
        const result = await s.act(await effect.action(s));
        const step = result.results[0];

        expect(step.ok, step.error?.message).toBe(true);
        expect(step.changes).toMatchObject(effect.expected);
        expect(step.changes.url_before).toBe(before);
        if (effect.urlAfter) {
          expect(step.changes.url_after).toMatch(effect.urlAfter);
          expect(result.url).toBe(step.changes.url_after);
        }
      });
    }
  });

  describe('G4.2 nothing happened is a result', () => {
    gate(
      'G4.2',
      'R-C2',
      'a dead button reports no observable change, and the page agrees',
      async () => {
        const s = await ctx.open('states');
        const before = await s.page.content();
        const step = await s.ok({ type: 'click', ref: await s.ref('dead') });
        expect(step.changes.none).toBe(true);
        // It was really clicked — the absence of change is the page's doing.
        expect(await s.clicks()).toEqual(['dead']);
        expect(await s.page.content()).toBe(before);
      },
    );
  });

  describe('G4.3 settling', () => {
    gate('G4.3', 'R-C3', 'the result carries the snapshot diff', async () => {
      const s = await ctx.open('dupes');
      const doomed = await s.ref('delete-3');
      const result = await s.act({ type: 'click', ref: doomed });
      expect(result.diff.removed).toEqual([doomed]);
      expect(result.diff.added).toEqual([]);
    });

    gate(
      'G4.3',
      'R-C4 R-C3',
      'content that follows a 1.5 s request is already in the result',
      async () => {
        const s = await ctx.open('spa');
        const result = await s.act({
          type: 'click',
          ref: await s.ref('nav-slow'),
        });
        const step = result.results[0];
        expect(step.settled).toBe(true);
        expect(result.diff.added.map((e) => e.name)).toContain(
          'Download report',
        );
        expect(step.settle_ms).toBeGreaterThanOrEqual(1_300);
        expect(await s.page.locator('#slow-status').textContent()).toBe(
          'Report ready',
        );
      },
    );

    gate(
      'G4.3',
      'R-C4',
      'a route that polls for ever returns within the cap and says it is still busy',
      async () => {
        const s = await ctx.open('spa');
        const result = await s.act({
          type: 'click',
          ref: await s.ref('nav-live'),
        });
        const step = result.results[0];

        expect(s.lastActMs).toBeLessThan(SETTLE_CAP_MS + 1_500);
        expect(step.ok).toBe(true);
        expect(step.settled).toBe(false);
        expect(step.pending?.some((p) => p.includes('/api/poll'))).toBe(true);
        // The page is usable all the same, and the next action is not delayed
        // by the full cap again for nothing: it still works.
        await s.act({ type: 'click', ref: await s.ref('live-pause') });
        expect(await s.events('paused')).toHaveLength(1);
      },
    );

    gate(
      'G4.3',
      'R-C4',
      'a three-second streamed response is waited for',
      async () => {
        const s = await ctx.open('spa');
        const result = await s.act({
          type: 'click',
          ref: await s.ref('nav-stream'),
        });
        expect(result.results[0].settled).toBe(true);
        expect(await s.page.locator('#log').textContent()).toContain('chunk 6');
        expect(s.lastActMs).toBeLessThan(SETTLE_CAP_MS + 1_500);
      },
    );

    gate('G4.3', 'R-C4', 'a quiet page is not made to wait', async () => {
      const s = await ctx.open('dupes');
      await s.ok({ type: 'click', ref: await s.ref('delete-1') });
      expect(s.lastActMs).toBeLessThan(600);
    });
  });

  describe('G4.4 sequences', () => {
    gate(
      'G4.4',
      'R-B5',
      'a ten-action form fill runs as one call',
      async () => {
        const s = await ctx.open('forms');
        const result = await s.act(
          { type: 'fill', ref: await s.ref('text'), text: 'Ada Lovelace' },
          { type: 'fill', ref: await s.ref('email'), text: 'ada@example.com' },
          { type: 'fill', ref: await s.ref('number'), text: '3' },
          { type: 'fill', ref: await s.ref('date'), text: '1815-12-10' },
          {
            type: 'fill',
            ref: await s.ref('textarea'),
            text: 'First programmer',
          },
          { type: 'check', ref: await s.ref('terms'), checked: true },
          { type: 'check', ref: await s.ref('plan-pro'), checked: true },
          { type: 'check', ref: await s.ref('switch'), checked: true },
          { type: 'fill', ref: await s.ref('price'), text: '99' },
          { type: 'click', ref: await s.ref('submit') },
        );
        expect(result).toMatchObject({ executed: 10, requested: 10 });
        expect(result.stopped).toBeUndefined();
        expect(result.results.every((r) => r.ok)).toBe(true);
        const [submit] = await s.events('submit');
        expect(submit.detail).toMatchObject({
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          quantity: '3',
          date: '1815-12-10',
          bio: 'First programmer',
          terms: 'on',
          plan: 'pro',
          price: '99.00',
        });
      },
    );

    gate(
      'G4.4',
      'R-B5',
      'a sequence stops after the action that navigates',
      async () => {
        const s = await ctx.open('spa');
        const refresh = await s.ref('home-action');
        const profile = await s.ref('nav-profile');
        const click = (ref: string): Action => ({ type: 'click', ref });
        const result = await s.act(
          click(refresh),
          click(refresh),
          click(refresh),
          click(profile),
          click(refresh),
          click(refresh),
          click(refresh),
          click(refresh),
          click(refresh),
          click(refresh),
        );
        expect(result).toMatchObject({
          executed: 4,
          requested: 10,
          stopped: 'navigated',
        });
        expect(result.results).toHaveLength(4);
        // Six were not run: the page proves it.
        expect((await s.state()).route).toBe('profile');
        expect(
          (await s.clicks()).filter((id) => id === 'home-action'),
        ).toHaveLength(3);
      },
    );

    gate(
      'G4.4',
      'R-B5',
      'a sequence stops at the first failure and leaves the rest undone',
      async () => {
        const s = await ctx.open('dupes');
        const result = await s.act(
          { type: 'click', ref: await s.ref('delete-1') },
          { type: 'click', ref: await s.ref('delete-2') },
          { type: 'click', ref: 'e999999' },
          { type: 'click', ref: await s.ref('delete-4') },
          { type: 'click', ref: await s.ref('delete-5') },
        );
        expect(result).toMatchObject({
          executed: 3,
          requested: 5,
          stopped: 'failed',
        });
        expect(result.results.map((r) => r.ok)).toEqual([true, true, false]);
        expect(result.results[2].error?.code).toBe('unknown_ref');
        expect((await s.state()).rows).toEqual([3, 4, 5]);
      },
    );

    gate(
      'G4.4',
      'R-B5',
      'a sequence stops when a dialog opens or a tab appears',
      async () => {
        const dialogs = await ctx.open('dialogs');
        const first = await dialogs.act(
          { type: 'click', ref: await dialogs.ref('alert') },
          { type: 'click', ref: await dialogs.ref('confirm') },
        );
        expect(first).toMatchObject({ executed: 1, stopped: 'dialog' });

        const tabs = await ctx.open('tabs');
        const second = await tabs.act(
          { type: 'click', ref: await tabs.ref('open-button') },
          { type: 'click', ref: await tabs.ref('same-tab-link') },
        );
        expect(second).toMatchObject({ executed: 1, stopped: 'tab' });
        expect(tabs.page.url()).toMatch(/\/tabs$/);
      },
    );

    gate(
      'G4.4',
      'R-B5',
      'an empty sequence is an invalid call, not a silent success',
      async () => {
        const s = await ctx.open('dupes');
        await expect(s.act()).rejects.toThrow(/actions/);
      },
    );
  });

  describe('G4.5 the step budget', () => {
    gate(
      'G4.5',
      'R-B6',
      'each executed action costs exactly one step, failed ones included',
      async () => {
        const s = await ctx.open('dupes');
        const first = await s.act(
          { type: 'click', ref: await s.ref('delete-1') },
          { type: 'click', ref: await s.ref('delete-2') },
        );
        expect(first.step).toBe(2);
        expect(s.stepCount).toBe(2);

        const second = await s.act({ type: 'click', ref: 'e999999' });
        expect(second.step).toBe(3);
        expect(second.steps_remaining).toBe(first.steps_remaining - 1);
      },
    );

    gate('G4.5', 'R-B6', 'taking a snapshot costs no step', async () => {
      const s = await ctx.open('dupes');
      await s.snapshot();
      await s.capture({ format: 'text' });
      expect(s.stepCount).toBe(0);
    });

    gate(
      'G4.5',
      'R-B6',
      'a sequence that would pass the limit stops at the limit',
      async () => {
        const s = await ctx.open('dupes', undefined, { timeout: 3 });
        const result = await s.act(
          { type: 'click', ref: await s.ref('delete-1') },
          { type: 'click', ref: await s.ref('delete-2') },
          { type: 'click', ref: await s.ref('delete-3') },
          { type: 'click', ref: await s.ref('delete-4') },
          { type: 'click', ref: await s.ref('delete-5') },
        );
        expect(result).toMatchObject({
          executed: 3,
          stopped: 'step_limit',
          steps_remaining: 0,
        });
        expect((await s.state()).rows).toEqual([4, 5]);
        await expect(s.act({ type: 'reload' })).rejects.toThrow(/step limit/);
      },
    );
  });

  describe('G4.6 timing and carried-over fields', () => {
    gate(
      'G4.6',
      'R-C5',
      'each step reports how long the action and the settling took',
      async () => {
        const s = await ctx.open('spa');
        const result = await s.act({
          type: 'click',
          ref: await s.ref('nav-slow'),
        });
        const step = result.results[0];
        expect(step.action_ms).toBeGreaterThanOrEqual(0);
        expect(step.settle_ms).toBeGreaterThanOrEqual(0);
        expect(step.action_ms + step.settle_ms).toBeLessThanOrEqual(
          s.lastActMs + 5,
        );
        expect(step.action_ms + step.settle_ms).toBeGreaterThan(
          s.lastActMs * 0.5,
        );
      },
    );

    gate(
      'G4.6',
      'R-C6',
      'console errors and failed requests are delivered with the action that caused them',
      async () => {
        const noisy = await ctx.open('dupes');
        await noisy.page.evaluate(() => {
          window.__gauntlet.find('delete-1').addEventListener('click', () => {
            console.error('row handler exploded');
            fetch('/api/dead').catch(() => {});
          });
        });
        const loud = await noisy.act({
          type: 'click',
          ref: await noisy.ref('delete-1'),
        });
        // In the result of this action — not the next one, and not lost.
        expect(loud.console_errors).toContain('row handler exploded');
        expect(loud.network_errors).toEqual([
          expect.stringContaining(`${noisy.gauntlet.baseUrl}/api/dead`),
        ]);
        const quiet = await noisy.act({
          type: 'click',
          ref: await noisy.ref('delete-2'),
        });
        expect(quiet.console_errors).toEqual([]);
        expect(quiet.network_errors).toEqual([]);
      },
    );

    gate('G4.6', 'R-C6', 'the result states the page it ended on', async () => {
      const s = await ctx.open('tabs');
      const result = await s.act({
        type: 'click',
        ref: await s.ref('same-tab-link'),
      });
      expect(result.title).toBe('Gauntlet — child tab');
      expect(result.url).toBe(s.page.url());
    });
  });
});
