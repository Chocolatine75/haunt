// T1 — the plan (R-T1 … R-T4).
import { describe, expect } from 'vitest';
import { TESTER_PAGES } from '../../test-support/gauntlet/server.js';
import type { InventoryControl } from './contract.js';
import { TESTER, exercisedBy, gate, useTester } from './harness.js';

describe('T1 the plan', () => {
  const ctx = useTester();

  describe('T1.1 the inventory', () => {
    for (const page of TESTER_PAGES) {
      gate(
        'T1.1',
        'R-T1',
        `${page}: the inventory is exactly the page's controls, with their groups and states`,
        async () => {
          const session = await ctx.qa(page);
          const { inventory } = await session.plan();
          const expected: InventoryControl[] = [];
          for (const control of TESTER[page].controls) {
            expected.push({
              ref: await session.ref(control.g),
              role: control.role,
              name: control.name,
              group: control.group,
              ...(control.state ? { state: control.state } : {}),
              exercised: false,
              planned: false,
            });
          }
          const byRef = (a: InventoryControl, b: InventoryControl) =>
            a.ref.localeCompare(b.ref);
          expect([...inventory].sort(byRef)).toEqual(expected.sort(byRef));
          // The same page, the same inventory.
          expect((await session.plan()).inventory).toEqual(inventory);
        },
      );
    }
  });

  describe('T1.2 cases', () => {
    gate(
      'T1.2',
      'R-T2',
      'a case naming a reference the page does not have is refused; a valid one is listed',
      async () => {
        const session = await ctx.qa('qa-search');
        const [one] = session.truth.cases;
        const valid = await session.caseOf(one);

        const refused = await ctx.haunt.call('haunt_plan', {
          session_id: session.id,
          cases: [{ ...valid, id: 'ghost', controls: ['e9999'] }],
        });
        expect(refused.isError).toBe(true);
        expect(refused.text).toContain('e9999');
        expect((await session.plan()).cases).toEqual([]);

        const plan = await session.plan({ cases: [valid] });
        expect(plan.cases).toEqual([valid]);
        expect(
          plan.inventory.filter((c) => c.planned).map((c) => c.ref),
        ).toEqual(valid.controls);
        expect(plan.coverage.cases).toEqual({
          planned: 1,
          run: 0,
          passed: 0,
          failed: 0,
        });
      },
    );
  });

  describe('T1.3 the plan follows the page', () => {
    gate(
      'T1.3',
      'R-T3',
      'the controls a dialog brings are reported by the action that opened it, and are in the inventory as not planned',
      async () => {
        const session = await ctx.qa('qa-dialog');
        const { opens, controls } = session.truth;
        if (!opens) throw new Error('qa-dialog opens nothing');
        const brought = controls.filter((c) => opens.controls.includes(c.g));

        const before = await session.plan();
        expect(
          before.inventory.filter((c) => c.state === 'hidden').length,
        ).toBe(brought.length);

        const result = await session.act([
          { type: 'click', ref: await session.ref(opens.by) },
        ]);
        expect(
          (result.new_controls ?? []).map(({ role, name }) => ({ role, name })),
        ).toEqual(brought.map(({ role, name }) => ({ role, name })));

        const after = await session.plan();
        for (const control of result.new_controls ?? []) {
          const listed = after.inventory.find((c) => c.ref === control.ref);
          expect(listed, control.name).toMatchObject({
            planned: false,
            exercised: false,
          });
          expect(listed && 'state' in listed, control.name).toBe(false);
        }
        // An action that brings nothing says nothing.
        const again = await session.act([
          {
            type: 'fill',
            ref: await session.ref('display-name'),
            text: 'Grace',
          },
        ]);
        expect('new_controls' in again).toBe(false);
      },
    );
  });

  describe('T1.4 coverage', () => {
    for (const page of TESTER_PAGES) {
      gate(
        'T1.4',
        'R-T4',
        `${page}: coverage counts what was acted on, and names what is left`,
        async () => {
          const session = await ctx.qa(page);
          const truth = session.truth;
          const planned = await session.register();
          // Naming a control in a case exercises nothing.
          expect(planned.coverage).toMatchObject({
            controls: { listed: truth.controls.length, exercised: 0 },
            cases: { planned: truth.cases.length, run: 0 },
          });
          expect(planned.coverage.left.cases).toEqual(
            truth.cases.map((one) => one.id),
          );

          await session.playAll();
          const done = exercisedBy(truth);
          const left = truth.controls.filter((c) => !done.includes(c.g));
          const { coverage, inventory } = await session.plan();
          expect(coverage.controls).toEqual({
            listed: truth.controls.length,
            exercised: done.length,
          });
          expect(coverage.cases).toEqual({
            planned: truth.cases.length,
            run: truth.cases.length,
            passed: 0,
            failed: truth.cases.length,
          });
          expect(coverage.left.cases).toEqual([]);
          expect(coverage.left.controls.map((c) => c.name).sort()).toEqual(
            left.map((c) => c.name).sort(),
          );
          expect(
            inventory
              .filter((c) => c.exercised)
              .map((c) => c.name)
              .sort(),
          ).toEqual(
            truth.controls
              .filter((c) => done.includes(c.g))
              .map((c) => c.name)
              .sort(),
          );
          // The session's result carries the same count.
          const ended = await session.end();
          expect(ended.coverage).toEqual(coverage);
          expect(ended.cases.map((c) => [c.id, c.verdict, c.by])).toEqual(
            truth.cases.map((one) => [one.id, 'failed', 'engine']),
          );
        },
      );
    }

    gate(
      'T1.4',
      'R-T4',
      'an action that failed exercises nothing',
      async () => {
        const session = await ctx.qa('qa-sort');
        const result = await ctx.haunt.call<{
          results: Array<{ ok: boolean }>;
        }>('haunt_act', {
          session_id: session.id,
          actions: [{ type: 'click', ref: await session.ref('compare') }],
        });
        expect(result.data.results[0].ok).toBe(false);
        expect((await session.plan()).coverage.controls.exercised).toBe(0);
      },
    );
  });
});
