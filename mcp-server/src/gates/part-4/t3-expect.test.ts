import { readFileSync } from 'node:fs';
// T3 — expect, act, check (R-T7 … R-T10).
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { EV_LOGIN } from '../../test-support/gauntlet/evidence-routes.js';
import { TESTER_PAGES } from '../../test-support/gauntlet/server.js';
import { filesUnder } from '../part-3/harness.js';
import type { Expectation, ExpectationResult } from './contract.js';
import { TESTER, type TesterSession, gate, useTester } from './harness.js';

describe('T3 expect, act, check', () => {
  const ctx = useTester();

  describe('T3.1 the planted defects', () => {
    for (const page of TESTER_PAGES) {
      for (const one of TESTER[page].cases) {
        for (const variant of ['buggy', 'clean'] as const) {
          gate(
            'T3.1',
            'R-T7',
            `${page} "${one.id}" ${variant}: the expectation ${variant === 'buggy' ? 'fails' : 'holds'}, with what was read`,
            async () => {
              const session = await ctx.qa(page, variant);
              await session.register([one]);
              const result = await session.play(one);
              expect(result.expectation?.held).toBe(variant === 'clean');
              if (one.read) {
                expect(result.expectation?.read).toEqual(one.read[variant]);
              }
              const [status] = (await session.plan()).cases;
              expect(status).toMatchObject({
                id: one.id,
                verdict: variant === 'clean' ? 'passed' : 'failed',
                by: 'engine',
                step: result.step,
              });
            },
          );
        }
      }
    }

    gate(
      'T3.1',
      'R-T7',
      'a case the engine cannot read is closed by the tester, with its sentence',
      async () => {
        const session = await ctx.qa('qa-rating');
        await session.register();
        const plan = await session.plan({
          close: [
            {
              id: 'stars-follow-score',
              verdict: 'failed',
              note: 'Every product shows five stars',
            },
          ],
        });
        expect(plan.cases[0]).toMatchObject({
          verdict: 'failed',
          by: 'tester',
          note: 'Every product shows five stars',
        });
        expect(plan.coverage.cases).toMatchObject({ run: 1, failed: 1 });
      },
    );
  });

  // An expectation stated with an action that changes nothing: what it
  // reads is the page as it is.
  async function check(
    session: TesterSession,
    expectation: Expectation,
  ): Promise<ExpectationResult> {
    const result = await session.act([{ type: 'read' }], {
      expect: expectation,
    });
    if (!result.expectation) throw new Error('no expectation in the result');
    return result.expectation;
  }

  describe('T3.2 every condition, both ways', () => {
    gate(
      'T3.2',
      'R-T8',
      'list: count, every, none, order as numbers and as text, and exact items',
      async () => {
        const dishes = {
          within: { role: 'list', name: 'Dishes' },
          items: 'listitem',
        };
        const menu = await ctx.qa('qa-filters', 'clean');
        const held = async (s: TesterSession, list: Expectation['list']) =>
          (await check(s, { list })).held;
        // Six dishes.
        expect(await held(menu, { ...dishes, count: { eq: 6 } })).toBe(true);
        expect(await held(menu, { ...dishes, count: { eq: 5 } })).toBe(false);
        expect(await held(menu, { ...dishes, count: { min: 6, max: 6 } })).toBe(
          true,
        );
        expect(await held(menu, { ...dishes, count: { min: 7 } })).toBe(false);
        expect(await held(menu, { ...dishes, count: { max: 5 } })).toBe(false);
        expect(await held(menu, { ...dishes, none_contains: 'PIZZA' })).toBe(
          false,
        );
        expect(await held(menu, { ...dishes, none_contains: 'burger' })).toBe(
          true,
        );
        expect(await held(menu, { ...dishes, every_contains: 'a' })).toBe(
          false,
        );
        expect(await held(menu, { ...dishes, every_contains: 'E' })).toBe(true);
        // A container the page does not have holds nothing.
        const absent = await check(menu, {
          list: {
            within: { role: 'list', name: 'Drinks' },
            items: 'listitem',
            count: { eq: 0 },
          },
        });
        expect(absent).toEqual({ held: true, read: [] });

        const products = {
          within: { role: 'list', name: 'Products' },
          items: 'listitem',
        };
        const shop = await ctx.qa('qa-sort', 'clean');
        await shop.act([
          {
            type: 'select',
            ref: await shop.ref('sort'),
            values: ['Price, low to high'],
          },
        ]);
        expect(
          await held(shop, { ...products, order: 'ascending', as: 'number' }),
        ).toBe(true);
        expect(
          await held(shop, { ...products, order: 'descending', as: 'number' }),
        ).toBe(false);
        // Pencil, Notebook, Desk lamp, Monitor arm, Standing desk: no order as text.
        expect(await held(shop, { ...products, order: 'ascending' })).toBe(
          false,
        );
        expect(
          await held(shop, { ...products, order: 'descending', as: 'text' }),
        ).toBe(false);
        await shop.act([
          {
            type: 'select',
            ref: await shop.ref('sort'),
            values: ['Price, high to low'],
          },
        ]);
        expect(
          await held(shop, { ...products, order: 'descending', as: 'number' }),
        ).toBe(true);

        const read = TESTER['qa-sort'].cases[0].read?.clean as string[];
        expect(
          await held(shop, { ...products, equals: [...read].reverse() }),
        ).toBe(true);
        expect(await held(shop, { ...products, equals: read })).toBe(false);

        // haunt_capture_state reads the same list.
        const captured = await shop.s.capture({ list: products } as never);
        expect((captured as { list?: string[] }).list).toEqual(
          [...read].reverse(),
        );
      },
    );

    gate(
      'T3.2',
      'R-T9',
      'value: what a field holds, checked, pressed, expanded and focused',
      async () => {
        const form = await ctx.qa('qa-form', 'clean');
        const weekly = await form.ref('weekly');
        const quantity = await form.ref('quantity');
        expect(
          await check(form, { value: { ref: quantity, of: 'value', is: '1' } }),
        ).toEqual({ held: true, read: '1' });
        expect(
          await check(form, { value: { ref: quantity, of: 'value', is: '2' } }),
        ).toEqual({ held: false, read: '1' });
        expect(
          await check(form, {
            value: { ref: weekly, of: 'checked', is: false },
          }),
        ).toEqual({ held: true, read: false });
        await form.act([{ type: 'check', ref: weekly, checked: true }]);
        expect(
          await check(form, {
            value: { ref: weekly, of: 'checked', is: false },
          }),
        ).toEqual({ held: false, read: true });
        expect(
          await check(form, {
            value: { ref: weekly, of: 'focused', is: true },
          }),
        ).toEqual({ held: true, read: true });
        expect(
          await check(form, {
            value: { ref: quantity, of: 'focused', is: true },
          }),
        ).toEqual({ held: false, read: false });

        const shop = await ctx.qa('qa-sort', 'clean');
        const compact = await shop.ref('compact');
        const details = await shop.ref('details');
        expect(
          await check(shop, {
            value: { ref: compact, of: 'pressed', is: false },
          }),
        ).toEqual({ held: true, read: false });
        expect(
          await check(shop, {
            value: { ref: details, of: 'expanded', is: true },
          }),
        ).toEqual({ held: false, read: false });
        await shop.act([
          { type: 'click', ref: compact },
          { type: 'click', ref: details },
        ]);
        expect(
          await check(shop, {
            value: { ref: compact, of: 'pressed', is: true },
          }),
        ).toEqual({ held: true, read: true });
        expect(
          await check(shop, {
            value: { ref: details, of: 'expanded', is: true },
          }),
        ).toEqual({ held: true, read: true });
      },
    );

    gate(
      'T3.2',
      'R-T7',
      'an expectation of no kind, or of two, is refused before anything is done',
      async () => {
        const session = await ctx.qa('qa-form', 'clean');
        const weekly = await session.ref('weekly');
        for (const expectation of [
          {},
          {
            text_present: 'Saved',
            value: { ref: weekly, of: 'checked', is: true },
          },
        ]) {
          const result = await ctx.haunt.call('haunt_act', {
            session_id: session.id,
            actions: [{ type: 'check', ref: weekly, checked: true }],
            expect: expectation,
          });
          expect(result.isError, JSON.stringify(expectation)).toBe(true);
        }
        expect((await session.plan()).coverage.controls.exercised).toBe(0);
      },
    );
  });

  describe('T3.3 a credential is never read in clear', () => {
    gate(
      'T3.3',
      'R-T9',
      'a password field reads as (filled) or (empty), in the result, the report and the bundle',
      async () => {
        const session = await ctx.ev('ev-login');
        const password = await session.s.s.ref('password');
        const act = async (expectation: Expectation, fill?: string) => {
          const result = await ctx.haunt.call<{
            expectation?: ExpectationResult;
          }>('haunt_act', {
            session_id: session.s.s.id,
            actions: fill
              ? [{ type: 'fill', ref: password, text: fill }]
              : [{ type: 'read' }],
            expect: expectation,
          });
          if (result.isError) throw new Error(result.text);
          return result.data.expectation;
        };
        const filled = {
          value: { ref: password, of: 'value' as const, is: '(filled)' },
        };
        expect(await act(filled)).toEqual({ held: false, read: '(empty)' });
        expect(await act(filled, EV_LOGIN.password)).toEqual({
          held: true,
          read: '(filled)',
        });
        // Stating the password itself tells nothing, and holds nothing.
        expect(
          await act({
            value: { ref: password, of: 'value', is: EV_LOGIN.password },
          }),
        ).toEqual({ held: false, read: '(filled)' });

        const ended = await ctx.haunt.call<{
          issues_found: Array<{
            verification: { status: string; bundle?: string };
          }>;
        }>('haunt_end_session', {
          session_id: session.s.s.id,
          issues: [
            {
              severity: 'minor',
              category: 'ux',
              description: 'The password field is filled',
              page_url: session.url,
              recommendation: 'None',
              observed: filled,
            },
          ],
        });
        if (ended.isError) throw new Error(ended.text);
        const [issue] = ended.data.issues_found;
        expect(issue.verification.status).toBe('confirmed');
        for (const file of filesUnder(issue.verification.bundle as string)) {
          if (file.endsWith('.png') || file.endsWith('.zip')) continue;
          expect(readFileSync(file, 'utf-8'), file).not.toContain(
            EV_LOGIN.password,
          );
        }
        expect(
          readFileSync(
            join(issue.verification.bundle as string, 'steps.json'),
            'utf-8',
          ),
        ).toContain('(filled)');
        for (const text of ctx.transcript) {
          expect(text).not.toContain(EV_LOGIN.password);
        }
      },
      180_000,
    );
  });

  describe('T3.4 a failed case is an issue’s claim', () => {
    gate(
      'T3.4',
      'R-T10',
      'an issue naming a failed case is confirmed by three replays',
      async () => {
        const session = await ctx.qa('qa-search');
        await session.register();
        await session.playAll();
        const ended = await session.end([
          session.issue({ case: 'titles-only' }),
        ]);
        expect(ended.rejected).toEqual([]);
        expect(ended.issues_found).toHaveLength(1);
        expect(ended.issues_found[0].verification).toMatchObject({
          status: 'confirmed',
          attempts: 3,
          reproduced: 3,
        });
        const bundle = ended.issues_found[0].verification.bundle as string;
        expect((await ctx.replay({ bundle })).outcome).toBe('reproduced');
      },
      180_000,
    );

    gate(
      'T3.4',
      'R-T10',
      'filed against the clean page, where the case passed, it is rejected',
      async () => {
        const session = await ctx.qa('qa-search', 'clean');
        await session.register();
        await session.playAll();
        const ended = await session.end([
          session.issue({ case: 'titles-only' }),
        ]);
        expect(ended.issues_found).toEqual([]);
        expect(ended.rejected.map((i) => i.verification)).toMatchObject([
          { status: 'rejected', reason: 'not_reproduced' },
        ]);
      },
      180_000,
    );

    gate(
      'T3.4',
      'R-T10',
      'an issue naming a case that was never run, or that does not exist, is rejected',
      async () => {
        const session = await ctx.qa('qa-search');
        await session.register();
        const ended = await session.end([
          session.issue({ case: 'titles-only' }),
          session.issue({ case: 'no-such-case' }),
        ]);
        expect(ended.issues_found).toEqual([]);
        expect(ended.rejected.map((i) => i.verification.reason)).toEqual([
          'unknown_case',
          'unknown_case',
        ]);
      },
    );
  });
});
