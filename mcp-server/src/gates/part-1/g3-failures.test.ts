// G3 — failures are exact and fast (R-D1 … R-D4, R-B2, R-B3).
import { describe, expect } from 'vitest';
import {
  type Action,
  type ActionError,
  FAILURE_CODES,
  type FailureCode,
} from './contract.js';
import { type Session, gate, useGauntlet, worstOf } from './harness.js';

describe('G3 failures', () => {
  const ctx = useGauntlet();

  // One way to produce each failure code, with the detail it must carry.
  const CASES: Record<
    FailureCode,
    (open: typeof ctx.open) => Promise<{
      s: Session;
      error: ActionError;
      check: () => Promise<void> | void;
    }>
  > = {
    unknown_ref: async (open) => {
      const s = await open('dupes');
      const error = await s.fail({ type: 'click', ref: 'e999999' });
      return { s, error, check: () => {} };
    },
    stale_ref: async (open) => {
      const s = await open('dynamic');
      const old = await s.ref('contact-ada');
      await s.page.locator('[data-g=filter]').press('a');
      const error = await s.fail({ type: 'click', ref: old });
      return {
        s,
        error,
        check: async () => {
          expect(error.similar_ref).toBe(await s.ref('contact-ada'));
          expect(error.similar_ref).not.toBe(old);
        },
      };
    },
    covered: async (open) => {
      const s = await open('overlays', 'case=modal');
      const error = await s.fail({ type: 'click', ref: await s.ref('target') });
      return {
        s,
        error,
        check: async () =>
          expect(error.covered_by).toBe(await s.ref('backdrop')),
      };
    },
    disabled: async (open) => {
      const s = await open('states');
      const error = await s.fail({ type: 'click', ref: await s.ref('submit') });
      return { s, error, check: () => {} };
    },
    not_visible: async (open) => {
      const s = await open('states');
      const error = await s.fail({
        type: 'click',
        ref: await s.ref('invisible'),
      });
      return { s, error, check: () => expect(error.reason).toBe('visibility') };
    },
    not_editable: async (open) => {
      const s = await open('dupes');
      const error = await s.fail({
        type: 'fill',
        ref: await s.ref('delete-1'),
        text: 'x',
      });
      return { s, error, check: () => expect(error.role).toBe('button') };
    },
    no_such_option: async (open) => {
      const s = await open('selects');
      const error = await s.fail({
        type: 'select',
        ref: await s.ref('native-single'),
        values: ['Kiwi'],
      });
      return {
        s,
        error,
        check: () =>
          expect(error.options).toEqual([
            'Choose…',
            'Apple',
            'Banana',
            'Cherry',
            'Durian (out of stock)',
          ]),
      };
    },
    not_a_file_input: async (open) => {
      const s = await open('dupes');
      const error = await s.fail({
        type: 'upload',
        ref: await s.ref('delete-1'),
        files: ['/tmp/x.txt'],
      });
      return { s, error, check: () => {} };
    },
    dialog_open: async (open) => {
      const s = await open('dialogs');
      const confirm = await s.ref('confirm');
      await s.act({ type: 'click', ref: await s.ref('alert') });
      const error = await s.fail({ type: 'click', ref: confirm });
      return {
        s,
        error,
        check: () =>
          expect(error.dialog).toEqual({
            type: 'alert',
            message: 'Maintenance tonight at 22:00',
          }),
      };
    },
    no_dialog: async (open) => {
      const s = await open('dialogs');
      const error = await s.fail({ type: 'dialog', accept: true });
      return { s, error, check: () => {} };
    },
    timeout: async (open) => {
      const s = await open('dupes');
      const error = await s.fail({
        type: 'wait_for',
        text: 'Payment received',
        timeout_ms: 500,
      });
      return { s, error, check: () => expect(error.observed).toBeTruthy() };
    },
    navigation_failed: async (open) => {
      const s = await open('dupes');
      const error = await s.fail({
        type: 'goto',
        url: `${s.gauntlet.baseUrl}/api/dead`,
      });
      return { s, error, check: () => expect(error.status).toBeTruthy() };
    },
    sandbox_blocked: async (open) => {
      const s = await open('dupes');
      const error = await s.fail({
        type: 'goto',
        url: `${s.gauntlet.otherUrl}/tabs/child?token=secret`,
      });
      return {
        s,
        error,
        check: () => {
          expect(error.blocked).toBe(`GET ${s.gauntlet.otherUrl}/tabs/child`);
          expect(JSON.stringify(error)).not.toContain('secret');
        },
      };
    },
    invalid_action: async (open) => {
      const s = await open('dupes');
      const error = await s.fail({ type: 'click' } as unknown as Action);
      return { s, error, check: () => expect(error.parameter).toBe('ref') };
    },
  };

  describe('G3.1 every failure code', () => {
    for (const code of FAILURE_CODES) {
      gate(
        'G3.1',
        'R-D1',
        `${code}: produced with its code, a readable message and its detail`,
        async () => {
          const { error, check } = await CASES[code](ctx.open);
          expect(error.code).toBe(code);
          expect(error.message.length).toBeGreaterThan(10);
          // Never a raw stack or a Playwright call log.
          expect(error.message).not.toMatch(/\n\s+at |Call log:|locator\./);
          await check();
        },
      );
    }

    gate(
      'G3.1',
      'R-D1',
      'not_visible says which kind of invisible',
      async () => {
        const s = await ctx.open('states');
        for (const [id, reason] of [
          ['invisible', 'visibility'],
          ['not-rendered', 'display'],
          ['zero-size', 'zero_size'],
        ] as const) {
          const error = await s.fail({ type: 'click', ref: await s.ref(id) });
          expect(error, id).toMatchObject({ code: 'not_visible', reason });
        }
      },
    );

    gate(
      'G3.1',
      'R-D1',
      'disabled covers the attribute, aria-disabled and a disabled fieldset',
      async () => {
        const s = await ctx.open('states');
        for (const id of ['submit', 'aria-disabled', 'in-disabled-fieldset']) {
          const error = await s.fail({ type: 'click', ref: await s.ref(id) });
          expect(error.code, id).toBe('disabled');
        }
        expect(await s.clicks()).toEqual([]);
        expect(await s.events('ignored')).toEqual([]);
      },
    );

    gate(
      'G3.1',
      'R-D1',
      'invalid_action names the offending parameter',
      async () => {
        const s = await ctx.open('dupes');
        const bad: Array<[unknown, string]> = [
          [{ type: 'teleport' }, 'type'],
          [{ type: 'fill', ref: await s.ref('login-email') }, 'text'],
          [{ type: 'scroll', direction: 'sideways' }, 'direction'],
          [{ type: 'click', ref: await s.ref('delete-1'), count: 7 }, 'count'],
          [{ type: 'wait_for' }, 'text'],
          [{ type: 'tab', op: 'switch' }, 'index'],
        ];
        for (const [action, parameter] of bad) {
          const error = await s.fail(action as Action);
          expect(error, JSON.stringify(action)).toMatchObject({
            code: 'invalid_action',
            parameter,
          });
        }
        expect(await s.clicks()).toEqual([]);
      },
    );
  });

  describe('G3.2 covered elements', () => {
    for (const [query, target, cover] of [
      ['case=modal', 'target', 'backdrop'],
      ['case=banner', 'target', 'banner'],
      ['case=glass', 'target', 'glass'],
    ] as const) {
      gate(
        'G3.2',
        'R-B2 R-B3 R-D2 R-D3',
        `${query}: fails as covered, names the cover, in under 2 s, and clicks nothing`,
        async () => {
          const s = await ctx.open('overlays', query);
          const ref = await s.ref(target);
          const coverRef = await s.ref(cover);

          const start = performance.now();
          const error = await s.fail({ type: 'click', ref });
          expect(performance.now() - start).toBeLessThan(2_000);

          expect(error).toMatchObject({
            code: 'covered',
            covered_by: coverRef,
          });
          // Neither the target nor the thing covering it received anything.
          expect(await s.clicks()).toEqual([]);
          expect(await s.status()).toBe('');
        },
      );
    }

    gate(
      'G3.2',
      'R-B2 R-B3',
      'a pointer-events: none button is not clicked by script',
      async () => {
        const s = await ctx.open('states');
        const result = await s.act({
          type: 'click',
          ref: await s.ref('no-pointer'),
        });
        expect(result.results[0].ok).toBe(false);
        expect(await s.status()).toBe('');
      },
    );

    gate(
      'G3.2',
      'R-B2',
      'sticky header: the target is scrolled clear of it and clicked',
      async () => {
        const s = await ctx.open('overlays', 'case=sticky');
        await s.ok({ type: 'click', ref: await s.ref('target') });
        expect(await s.clicks()).toEqual(['target']);
        expect(await s.status()).toBe('Target clicked');
      },
    );

    gate(
      'G3.2',
      'R-D2',
      'hover, fill and drag on a covered element fail the same way',
      async () => {
        const s = await ctx.open('overlays', 'case=glass');
        const ref = await s.ref('target');
        for (const action of [
          { type: 'hover', ref },
          { type: 'drag', from_ref: ref, offset: { x: 10, y: 0 } },
        ] as Action[]) {
          expect((await s.fail(action)).code, action.type).toBe('covered');
        }
      },
    );
  });

  describe('G3.3 waiting for actionability', () => {
    gate(
      'G3.3',
      'R-B2',
      'toast: the click waits out a cover that leaves by itself',
      async () => {
        const s = await ctx.open('overlays', 'case=toast');
        await s.ok({ type: 'click', ref: await s.ref('target') });
        expect(await s.clicks()).toEqual(['target']);
        // It was performed after the toast left, not through it.
        const [gone] = await s.events('gone');
        const [click] = await s.events('click');
        expect(click.t).toBeGreaterThanOrEqual(gone.t);
      },
    );

    gate(
      'G3.3',
      'R-B2',
      'a button that enables itself is clicked once it is enabled',
      async () => {
        const s = await ctx.open('states');
        await s.ok(
          { type: 'fill', ref: await s.ref('email'), text: 'me@work.io' },
          { type: 'check', ref: await s.ref('agree'), checked: true },
          { type: 'click', ref: await s.ref('submit') },
        );
        expect(await s.status()).toBe('Subscribed');
      },
    );
  });

  describe('G3.4 moving targets', () => {
    gate(
      'G3.4',
      'R-B2',
      'a moving button is clicked once it has stopped, and the click lands on it',
      async () => {
        const s = await ctx.open('dynamic');
        await s.ok({ type: 'click', ref: await s.ref('runner') });
        expect(await s.clicks()).toEqual(['runner']);
        const [caught] = await s.events('caught');
        expect(caught.detail).toBe(true);
      },
    );
  });

  describe('G3.5 stale references', () => {
    gate(
      'G3.5',
      'R-D1 R-D3 R-A8',
      'a reference to a rebuilt node fails, offers the new one, and clicks nothing',
      async () => {
        const s = await ctx.open('dynamic');
        const old = await s.ref('contact-grace');
        await s.page.locator('[data-g=filter]').press('a');
        await s.page.locator('[data-g=filter]').press('Backspace');

        const error = await s.fail({ type: 'click', ref: old });
        expect(error.code).toBe('stale_ref');
        expect(await s.events('opened')).toEqual([]);

        // The offered reference works.
        await s.ok({ type: 'click', ref: error.similar_ref as string });
        expect((await s.events('opened')).map((e) => e.id)).toEqual([
          'contact-grace',
        ]);
      },
    );

    gate(
      'G3.5',
      'R-D1',
      'a reference to a node that is gone for good offers nothing',
      async () => {
        const s = await ctx.open('dupes');
        const old = await s.ref('delete-3');
        await s.page.locator('[data-g=delete-3]').click();
        const error = await s.fail({ type: 'click', ref: old });
        expect(error.code).toBe('stale_ref');
        expect(error.similar_ref).toBeUndefined();
        expect((await s.state()).rows).toEqual([1, 2, 4, 5]);
      },
    );

    gate(
      'G3.5',
      'R-D3 R-A8',
      '100 actions racing a list rebuilt every 40 ms never touch the wrong node',
      async () => {
        const s = await ctx.open('dynamic');
        let succeeded = 0;
        let stale = 0;

        for (let i = 0; i < 100; i++) {
          if (!(await s.state()).churning) {
            await s.page.locator('[data-g=churn]').click();
          }
          const { elements } = await s.snapshot();
          const ada = elements.find(
            (e) => e.attributes?.['data-g'] === 'contact-ada',
          );
          if (!ada) continue;
          const result = await s.act({ type: 'click', ref: ada.ref });
          const step = result.results[0];
          if (step.ok) succeeded++;
          else {
            expect(step.error?.code).toBe('stale_ref');
            stale++;
          }
        }

        const opened = await s.events('opened');
        // Every click that was reported as done landed on Ada, and nothing else
        // was ever opened.
        expect(opened.every((e) => e.id === 'contact-ada')).toBe(true);
        expect(opened).toHaveLength(succeeded);
        expect(succeeded + stale).toBeGreaterThan(90);
        // The race is real: at least some references went stale in flight.
        expect(stale).toBeGreaterThan(0);
      },
      180_000,
    );
  });

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

    gate(
      'G3.6',
      'R-D2',
      'every other failure returns in under 2 s',
      async () => {
        for (const code of [
          'covered',
          'not_visible',
          'no_such_option',
          'not_a_file_input',
          'dialog_open',
          'navigation_failed',
          'sandbox_blocked',
        ] as const) {
          // The failing action is the last call each case makes.
          const { s } = await CASES[code](ctx.open);
          expect(s.lastActMs, code).toBeLessThan(2_000);
        }
      },
      120_000,
    );

    gate('G3.6', 'R-D2', 'a caller can ask for a longer wait', async () => {
      const s = await ctx.open('dynamic');
      const start = performance.now();
      await s.ok({
        type: 'wait_for',
        text: 'Download invoice',
        timeout_ms: 4_000,
      });
      expect(performance.now() - start).toBeLessThan(4_000);
    });
  });

  describe('G3.7 a failed action leaves things as they were', () => {
    gate(
      'G3.7',
      'R-D3',
      'a refused fill does not touch the field',
      async () => {
        const s = await ctx.open('forms');
        expect(
          (
            await s.fail({
              type: 'fill',
              ref: await s.ref('readonly'),
              text: 'changed',
            })
          ).code,
        ).toBe('not_editable');
        expect(await s.dom('readonly', 'el.value')).toBe('ACC-0042');

        expect(
          (
            await s.fail({
              type: 'fill',
              ref: await s.ref('disabled-input'),
              text: 'changed',
            })
          ).code,
        ).toBe('disabled');
        expect(await s.dom('disabled-input', 'el.value')).toBe('n/a');
        expect(await s.events('input')).toEqual([]);
      },
    );

    gate(
      'G3.7',
      'R-D3',
      'a refused select keeps the previous choice',
      async () => {
        const s = await ctx.open('selects');
        const ref = await s.ref('native-single');
        await s.ok({ type: 'select', ref, values: ['Apple'] });
        await s.fail({
          type: 'select',
          ref,
          values: ['Durian (out of stock)'],
        });
        expect(await s.dom('native-single', 'el.value')).toBe('apple');
      },
    );

    gate(
      'G3.7',
      'R-D3',
      'a multi-value select with one bad value selects none of them',
      async () => {
        const s = await ctx.open('selects');
        await s.fail({
          type: 'select',
          ref: await s.ref('native-multiple'),
          values: ['Ham', 'Pineapple'],
        });
        expect(
          await s.dom('native-multiple', '[...el.selectedOptions].length'),
        ).toBe(0);
      },
    );
  });

  describe('G3.8 a failure is information, not an app bug', () => {
    gate(
      'G3.8',
      'R-D4',
      'no failed action is filed as an issue by the server',
      async () => {
        const s = await ctx.open('states');
        await s.fail({ type: 'click', ref: await s.ref('submit') });
        await s.fail({ type: 'click', ref: await s.ref('invisible') });
        await s.fail({ type: 'click', ref: 'e999999' });
        await s.ok({ type: 'click', ref: await s.ref('dead') });
        // Last: a navigation that fails leaves the browser's error page.
        await s.fail({ type: 'goto', url: `${s.gauntlet.baseUrl}/api/dead` });

        const overlay = await ctx.open('overlays', 'case=modal');
        await overlay.fail({ type: 'click', ref: await overlay.ref('target') });

        expect(s.filedIssues).toEqual([]);
        expect(overlay.filedIssues).toEqual([]);
        expect((await s.end()).issues_found).toEqual([]);
      },
    );
  });
});
