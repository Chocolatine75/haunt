// T5 — seeing, the brief, repeats (R-T13 … R-T16).
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { runHeadlessTest } from '../../cli/headless.js';
import type { ActionDecider } from '../../cli/providers/types.js';
import { REPORTS_DIR } from '../../engine/constants.js';
import { SessionManager } from '../../engine/session/manager.js';
import { gate, useTester } from './harness.js';

describe('T5 seeing, the brief, repeats', () => {
  const ctx = useTester();
  const written: string[] = [];
  const cleanUp = () => {
    for (const path of written.splice(0)) rmSync(path, { force: true });
  };

  describe('T5.1 a screenshot on request', () => {
    gate(
      'T5.1',
      'R-T13',
      'haunt_capture_state returns an image of the page, the same with the login fields filled as empty',
      async () => {
        const page = await ctx.qa('qa-rating');
        const shot = await ctx.haunt.call<{ screenshot_path?: string }>(
          'haunt_capture_state',
          { session_id: page.id, include_screenshot: true },
        );
        const path = join(
          '.haunt-reports/screenshots',
          shot.data.screenshot_path ?? '',
        );
        expect(existsSync(path)).toBe(true);
        // A PNG.
        expect(readFileSync(path).subarray(1, 4).toString()).toBe('PNG');

        const login = await ctx.ev('ev-login');
        const empty = await login.screenshot('sign-in');
        await login.play(login.truth.steps.slice(0, 2));
        expect((await login.screenshot('sign-in')).equals(empty)).toBe(true);
      },
    );
  });

  describe('T5.2 no personas', () => {
    gate(
      'T5.2',
      'R-T14',
      'a session opens without a persona, and nothing it returns or writes has one',
      async () => {
        const url = ctx.gauntlet.url('qa-form', 'variant=clean');
        const before = ctx.transcript.length;
        const spawned = await ctx.haunt.call<{ session_id: string }>(
          'haunt_spawn',
          { target_url: url, replay_budget_ms: 0 },
        );
        expect(spawned.isError, spawned.text).toBe(false);
        const session_id = spawned.data.session_id;
        await ctx.haunt.call('haunt_capture_state', { session_id });
        await ctx.haunt.call('haunt_plan', { session_id });
        const ended = await ctx.haunt.call<Record<string, unknown>>(
          'haunt_end_session',
          { session_id },
        );
        expect(ended.isError, ended.text).toBe(false);
        try {
          const report = await ctx.haunt.call<{
            report_path: string;
            markdown: string;
          }>('haunt_generate_report', {
            target_url: url,
            date: '2026-04-06',
            sessions: [
              { area: '/qa-form', overall_impression: 'done', issues: [] },
            ],
          });
          expect(report.isError, report.text).toBe(false);
          const sidecar = report.data.report_path.replace(/\.md$/, '.json');
          written.push(report.data.report_path, sidecar);
          for (const text of [
            ...ctx.transcript.slice(before),
            readFileSync(report.data.report_path, 'utf-8'),
            readFileSync(sidecar, 'utf-8'),
          ]) {
            expect(text).not.toMatch(/persona/i);
          }
        } finally {
          cleanUp();
        }
      },
    );

    gate(
      'T5.2c',
      'R-T14',
      'a report written before this part, personas in it, can still be compared with',
      async () => {
        const old = join(REPORTS_DIR, 'gate-t5-old.json');
        writeFileSync(
          old,
          JSON.stringify({
            target_url: 'http://localhost:3000',
            date: '2026-01-01',
            personas: ['confused-beginner'],
            issues: [
              {
                severity: 'major',
                category: 'ux',
                description: 'Gone since',
                page_url: '/old',
                recommendation: 'Fix it',
              },
            ],
          }),
        );
        written.push(old);
        try {
          const report = await ctx.haunt.call<{
            report_path: string;
            comparison?: { resolved: unknown[] };
            comparison_error?: string;
          }>('haunt_generate_report', {
            target_url: 'http://localhost:3000',
            date: '2026-04-07',
            sessions: [{ area: '/', overall_impression: 'done', issues: [] }],
            compare_with: old,
          });
          expect(report.isError, report.text).toBe(false);
          written.push(
            report.data.report_path,
            report.data.report_path.replace(/\.md$/, '.json'),
          );
          expect(report.data.comparison_error).toBeUndefined();
          expect(report.data.comparison?.resolved).toHaveLength(1);
        } finally {
          cleanUp();
        }
      },
    );

    gate(
      'T5.2b',
      'R-T14',
      'a hostile case is refused in a session not spawned for it, and accepted in one that is',
      async () => {
        const plain = await ctx.qa('qa-search', 'clean');
        const one = {
          id: 'script-in-search',
          kind: 'hostile' as const,
          controls: [await plain.ref('query')],
          expect: 'A script typed into the search box is shown as text',
        };
        const refused = await ctx.haunt.call('haunt_plan', {
          session_id: plain.id,
          cases: [one],
        });
        expect(refused.isError).toBe(true);
        expect(refused.text).toContain('hostile');

        const allowed = await ctx.qa('qa-search', 'clean', { hostile: true });
        const plan = await allowed.plan({
          cases: [{ ...one, controls: [await allowed.ref('query')] }],
        });
        expect(plan.cases.map((c) => c.kind)).toEqual(['hostile']);
      },
    );
  });

  describe('T5.3 a description of the app', () => {
    gate(
      'T5.3',
      'R-T15',
      'the text given as --spec reaches the decider verbatim, and the report names it',
      async () => {
        const spec =
          'Kettles must show as many stars as their score.\nA score of 2.0 is two stars — never five.';
        const systems: string[] = [];
        const decide = (async (system: string) => {
          systems.push(system);
          return { actions: [{ type: 'read' }], issues: [] };
        }) as unknown as ActionDecider;
        const manager = new SessionManager();
        try {
          const result = await runHeadlessTest(decide, manager, {
            targetUrl: ctx.gauntlet.url('qa-rating', 'variant=clean'),
            personas: [],
            steps: 1,
            headless: true,
            spec: { name: 'kettles.md', text: spec },
          } as never);
          written.push(
            result.report.report_path,
            result.report.report_path.replace(/\.md$/, '.json'),
          );
          expect(result.failures).toEqual([]);
          expect(systems.length).toBeGreaterThan(0);
          // The planner plans from it; the testers judge by it.
          for (const system of systems) expect(system).toContain(spec);
          expect(result.report.markdown).toContain('kettles.md');
          // The text itself stays out of the report: only its name.
          expect(result.report.markdown).not.toContain('never five');
        } finally {
          cleanUp();
        }
      },
    );

    gate(
      'T5.3',
      'R-T14 R-T15',
      'without a description the decider is given the method, and no character to play',
      async () => {
        const systems: string[] = [];
        const decide = (async (system: string) => {
          systems.push(system);
          return { actions: [{ type: 'read' }], issues: [] };
        }) as unknown as ActionDecider;
        try {
          const result = await runHeadlessTest(decide, new SessionManager(), {
            targetUrl: ctx.gauntlet.url('qa-rating', 'variant=clean'),
            personas: [],
            steps: 1,
            headless: true,
          });
          written.push(
            result.report.report_path,
            result.report.report_path.replace(/\.md$/, '.json'),
          );
          expect(systems.length).toBeGreaterThan(0);
          for (const system of systems) {
            expect(system).not.toMatch(
              /persona|you are (a|an) (confused|malicious)/i,
            );
          }
          // The steps of the method, in its own words, between the briefs.
          const all = systems.join('\n').toLowerCase();
          for (const word of ['inventory', 'expect', 'realistic']) {
            expect(all, word).toContain(word);
          }
        } finally {
          cleanUp();
        }
      },
    );
  });

  describe('T5.4 repeats', () => {
    gate(
      'T5.4',
      'R-T16',
      'the third time an action leaves the page as it was, the result says so and names what is left; the second does not',
      async () => {
        const session = await ctx.qa('qa-search', 'clean');
        const query = await session.ref('query');
        const fill = () =>
          session.act([{ type: 'fill', ref: query, text: 'garlic' }]);
        // The first changes the page: it is not a repeat of anything.
        expect('repeating' in (await fill())).toBe(false);
        expect('repeating' in (await fill())).toBe(false);
        expect('repeating' in (await fill())).toBe(false);
        const third = await fill();
        expect(third.repeating).toEqual({ times: 3 });
        expect(third.remaining?.controls.map((c) => c.name)).toEqual([
          'Titles only',
          'Clear',
        ]);
        // It ran all the same, and was counted.
        expect(third.results[0].ok).toBe(true);
        expect(third.steps_remaining).toBe(400 - 4);
        // Another control in between starts the count again.
        await session.act([
          {
            type: 'check',
            ref: await session.ref('titles-only'),
            checked: true,
          },
        ]);
        expect('repeating' in (await fill())).toBe(false);
      },
    );
  });
});
