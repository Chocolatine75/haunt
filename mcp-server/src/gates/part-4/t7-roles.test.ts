// T7 — one job each (R-T20 … R-T23).
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect } from 'vitest';
import { runHeadlessTest } from '../../cli/headless.js';
import type { ActionDecider } from '../../cli/providers/types.js';
import { SessionManager } from '../../engine/session/manager.js';
import { type Action, REF_IN_TEXT } from '../part-1/contract.js';
import {
  type DecisionTester,
  PLANNER_BRIEF_HEADING,
  REPORT_COVERAGE_HEADING,
  type ReportTesterSidecar,
  TESTER_BRIEF_HEADING,
} from './contract.js';
import { gate, useTester } from './harness.js';

const REPO_ROOT = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../..',
);

describe('T7 one job each', () => {
  const ctx = useTester();
  const written: string[] = [];
  const cleanUp = () => {
    for (const path of written.splice(0)) rmSync(path, { force: true });
  };

  describe('T7.1 a plan passes from one session to another', () => {
    gate(
      'T7.1',
      'R-T21',
      'the cases of a session register in another session of the same page, by what their controls are, and play there',
      async () => {
        const planner = await ctx.qa('qa-form');
        const { portable } = await planner.register();
        expect(portable.map((one) => one.id)).toEqual(
          planner.truth.cases.map((one) => one.id),
        );
        // By what the controls are: nothing of the planner's session.
        expect(JSON.stringify(portable)).not.toMatch(/"e\d+"/);
        expect(portable[0].controls).toEqual([
          {
            role: 'checkbox',
            name: 'Email me a weekly summary',
            group: 'form: Order settings',
          },
          { role: 'button', name: 'Save', group: 'form: Order settings' },
        ]);

        // A tester's session: the same page, references of its own. One
        // case of the two is handed to it.
        const tester = await ctx.qa('qa-form');
        const [first] = tester.truth.cases;
        const plan = await tester.plan({ cases: [portable[0]] });
        expect(plan.cases).toEqual([await tester.caseOf(first)]);
        const result = await tester.play(first);
        expect(result.expectation?.held).toBe(false);
        expect((await tester.plan()).coverage.cases).toEqual({
          planned: 1,
          run: 1,
          passed: 0,
          failed: 1,
        });
      },
    );

    gate(
      'T7.1',
      'R-T21',
      'a case naming a control the session does not have is refused, with the control named',
      async () => {
        const planner = await ctx.qa('qa-form');
        const { portable } = await planner.register();
        const elsewhere = await ctx.qa('qa-search');
        const refused = await ctx.haunt.call('haunt_plan', {
          session_id: elsewhere.id,
          cases: [portable[0]],
        });
        expect(refused.isError).toBe(true);
        expect(refused.text).toContain('Email me a weekly summary');
        expect((await elsewhere.plan()).cases).toEqual([]);
      },
    );
  });

  describe('T7.2 coverage is of the app', () => {
    gate(
      'T7.2',
      'R-T22',
      'two sessions on one area count its controls and cases once; a second area adds to them',
      async () => {
        // Two testers share qa-form's two cases; a third has qa-sort.
        const planner = await ctx.qa('qa-form');
        const { portable } = await planner.register();
        const ended = [];
        for (const [i, one] of planner.truth.cases.entries()) {
          const tester = await ctx.qa('qa-form');
          await tester.plan({ cases: [portable[i]] });
          await tester.play(one);
          ended.push({ area: '/qa-form', ...(await tester.end()) });
        }
        const shop = await ctx.qa('qa-sort');
        await shop.register();
        await shop.playAll();
        ended.push({ area: '/qa-sort', ...(await shop.end()) });

        const result = await ctx.haunt.call<{
          report_path: string;
          markdown: string;
        }>('haunt_generate_report', {
          target_url: ctx.gauntlet.baseUrl,
          date: '2026-04-08',
          sessions: ended.map((session) => ({
            area: session.area,
            overall_impression: 'done',
            issues: session.issues_found,
            cases: session.cases,
            inventory: session.inventory,
          })),
        });
        if (result.isError) throw new Error(result.text);
        const sidecarPath = result.data.report_path.replace(/\.md$/, '.json');
        written.push(result.data.report_path, sidecarPath);
        try {
          const sidecar = JSON.parse(
            readFileSync(sidecarPath, 'utf-8'),
          ) as ReportTesterSidecar;
          // qa-form has 3 controls, all exercised between the two testers:
          // one checked the box, the other filled the quantity, both saved.
          // qa-sort has 4, of which 1.
          expect(sidecar.coverage?.controls).toEqual({
            listed: 7,
            exercised: 4,
          });
          expect(sidecar.coverage?.cases).toEqual({
            planned: 3,
            run: 3,
            passed: 0,
            failed: 3,
          });
          expect(
            sidecar.coverage?.left.controls.map((c) => [c.area, c.name]),
          ).toEqual([
            ['/qa-sort', 'Compact view'],
            ['/qa-sort', 'Shipping details'],
            ['/qa-sort', 'Compare selected'],
          ]);
          const text = result.data.markdown.split(
            `## ${REPORT_COVERAGE_HEADING}`,
          )[1];
          expect(text).toContain('4 of 7 controls');
          expect(text).toContain('0 passed, 3 failed, 0 not run');
        } finally {
          cleanUp();
        }
      },
      180_000,
    );
  });

  describe('T7.3 the same separation in haunt-ci', () => {
    // Plans one case on qa-sort when asked as the planner, then plays it
    // when asked as the tester.
    function scripted(plans: boolean) {
      const calls: Array<{ system: string; state: string }> = [];
      const refOf = (state: string, name: string) => {
        const line = state
          .split('\n')
          .find((l) => l.includes(`"${name}"`) && /\[e\d+\]/.test(l));
        return line ? [...line.matchAll(REF_IN_TEXT)][0][1] : undefined;
      };
      const decide = (async (system: string, state: string) => {
        calls.push({ system, state });
        const sort = refOf(state, 'Sort by');
        if (system.includes(PLANNER_BRIEF_HEADING)) {
          const cases: DecisionTester['cases'] =
            plans && sort
              ? [
                  {
                    id: 'price-ascending',
                    kind: 'normal',
                    controls: [sort],
                    expect: 'Sorted low to high, the prices go up',
                  },
                ]
              : [];
          return { actions: [], issues: [], cases };
        }
        const playing = state.includes('price-ascending');
        const actions: Action[] =
          sort && playing
            ? [{ type: 'select', ref: sort, values: ['Price, low to high'] }]
            : [{ type: 'read' }];
        const decision: DecisionTester & { actions: Action[]; issues: [] } = {
          actions,
          issues: [],
        };
        if (sort && playing) {
          decision.case = 'price-ascending';
          decision.expect = {
            list: {
              within: { role: 'list', name: 'Products' },
              items: 'listitem',
              order: 'ascending',
              as: 'number',
            },
          };
        }
        return decision;
      }) as unknown as ActionDecider;
      return { calls, decide };
    }

    const run = async (plans: boolean) => {
      const { calls, decide } = scripted(plans);
      const result = await runHeadlessTest(decide, new SessionManager(), {
        targetUrl: ctx.gauntlet.url('qa-sort', 'variant=buggy'),
        personas: [],
        steps: 3,
        headless: true,
      });
      const sidecarPath = result.report.report_path.replace(/\.md$/, '.json');
      written.push(result.report.report_path, sidecarPath);
      expect(result.failures).toEqual([]);
      const sidecar = JSON.parse(
        readFileSync(sidecarPath, 'utf-8'),
      ) as ReportTesterSidecar;
      return { calls, result, sidecar };
    };

    gate(
      'T7.3',
      'R-T20 R-T23',
      'it asks for a plan before any action, registers the cases, then asks for each case’s actions under the tester’s brief',
      async () => {
        try {
          const { calls, sidecar } = await run(true);
          const [first, ...rest] = calls;
          expect(first.system).toContain(PLANNER_BRIEF_HEADING);
          expect(first.system).not.toContain(TESTER_BRIEF_HEADING);
          // The inventory, for the planner to plan from.
          for (const name of ['Sort by', 'Compact view', 'Compare selected']) {
            expect(first.state, name).toContain(`"${name}"`);
          }
          expect(first.state).toContain('disabled');

          expect(rest.length).toBeGreaterThan(0);
          for (const call of rest) {
            expect(call.system).toContain(TESTER_BRIEF_HEADING);
            expect(call.system).not.toContain(PLANNER_BRIEF_HEADING);
          }
          // The case to play, and what it expects, in front of the tester.
          expect(rest[0].state).toContain('price-ascending');
          expect(rest[0].state).toContain(
            'Sorted low to high, the prices go up',
          );

          expect(sidecar.coverage?.cases).toEqual({
            planned: 1,
            run: 1,
            passed: 0,
            failed: 1,
          });
          expect(sidecar.coverage?.controls).toEqual({
            listed: 4,
            exercised: 1,
          });
        } finally {
          cleanUp();
        }
      },
      180_000,
    );

    gate(
      'T7.3',
      'R-T23',
      'a decider that plans nothing still gets its session',
      async () => {
        try {
          const { calls, sidecar } = await run(false);
          expect(calls[0].system).toContain(PLANNER_BRIEF_HEADING);
          expect(calls.length).toBeGreaterThan(1);
          expect(sidecar.coverage?.cases.planned).toBe(0);
          expect(sidecar.coverage?.controls.listed).toBe(4);
        } finally {
          cleanUp();
        }
      },
      180_000,
    );
  });

  describe('T7.4 the plugin ships the roles', () => {
    const read = (path: string) => readFileSync(join(REPO_ROOT, path), 'utf-8');
    // The tools an agent file allows, from its frontmatter.
    const toolsOf = (source: string): string[] => {
      const frontmatter = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? '';
      const line = /^tools:\s*(.+)$/m.exec(frontmatter)?.[1] ?? '';
      return line
        .split(',')
        .map((tool) => tool.trim())
        .filter(Boolean);
    };

    gate(
      'T7.4',
      'R-T20',
      'an agent for each role, both named by the command; the planner’s cannot act on a page',
      async () => {
        const command = read('commands/haunt-test.md');
        const { tools } = await ctx.haunt.client.listTools();
        const provided = new Set(tools.map((tool) => tool.name));
        const allowed: Record<string, string[]> = {};
        for (const role of ['planner', 'tester']) {
          const path = `agents/haunt-${role}.md`;
          expect(existsSync(join(REPO_ROOT, path)), path).toBe(true);
          expect(command, role).toContain(`haunt-${role}`);
          const source = read(path);
          allowed[role] = toolsOf(source);
          expect(
            allowed[role].length,
            `${path} lists its tools`,
          ).toBeGreaterThan(0);
          // Nothing but haunt's own tools, and only ones that exist.
          for (const tool of allowed[role]) {
            const name = tool.replace(/^mcp__(plugin_haunt_)?haunt__/, '');
            expect(tool, tool).toMatch(/^mcp__(plugin_haunt_)?haunt__/);
            expect(provided, tool).toContain(name);
          }
          // In its text, that is: the front matter names the tools as the
          // host does, checked above.
          const text = source.replace(/^---\n[\s\S]*?\n---/, '');
          for (const name of text.match(/\bhaunt_[a-z_]+\b/g) ?? []) {
            expect(provided, `${path} mentions ${name}`).toContain(name);
          }
        }
        const short = (role: string) =>
          allowed[role].map((tool) => tool.replace(/^.*__/, ''));
        expect(short('planner')).not.toContain('haunt_act');
        expect(short('planner')).toContain('haunt_plan');
        expect(short('tester')).toContain('haunt_act');
        // The orchestrator tests nothing itself.
        expect(command).not.toMatch(/do NOT spawn sub-agents/i);
      },
    );
  });
});
