// What nine more applications showed (docs/v3/part-4-field.md), A: a tester
// that asks to end with cases unplayed and its budget unspent is held back
// once, and told what is left.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CASE_METHOD, TESTER_BRIEF } from '../../engine/brief.js';
import { useSignals } from '../part-2/harness.js';
import { PASSING } from './status.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const SPEC = join(REPO_ROOT, 'docs/v3/part-4-field.md');

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

interface Held {
  ended: false;
  left: {
    cases: string[];
    controls: Array<{ ref: string; role: string; name: string }>;
  };
  steps_remaining: number;
  todo: string;
}

interface Ended {
  session_id: string;
  step_count: number;
  issues_found: Array<{ description: string }>;
}

describe('F what nine more applications showed', () => {
  const ctx = useSignals();

  // A session on qa-sort (a select, two buttons, a disabled one) with one
  // case registered and one button pressed under no case.
  async function tester(spawn: Record<string, unknown>) {
    const session = await ctx.openUrl(
      ctx.gauntlet.url('qa-sort', 'variant=clean'),
      spawn,
    );
    const sort = await session.ref('sort');
    const planned = await ctx.haunt.call('haunt_plan', {
      session_id: session.id,
      brief: true,
      cases: [
        {
          id: 'sort-price',
          kind: 'state',
          controls: [sort],
          expect: 'With Price, low to high, the prices go up down the list.',
        },
      ],
    });
    if (planned.isError) throw new Error(planned.text);
    await session.ok({ type: 'click', ref: await session.ref('compact') });
    const end = (more: Record<string, unknown> = {}) =>
      ctx.haunt.call<Held & Ended>('haunt_end_session', {
        session_id: session.id,
        ...more,
      });
    return { session, end };
  }

  const ISSUE = {
    severity: 'minor',
    category: 'ux',
    description: 'The compact view keeps the long descriptions.',
    page_url: 'http://127.0.0.1/qa-sort',
    recommendation: 'Hide them.',
    expected: 'Short rows',
    actual: 'Long rows',
  };

  describe('F1 held back once', () => {
    gate(
      'F1.1',
      'R-F1',
      'asked to keep going, a session with a case unplayed and budget left is held back once, told what is left, and ends at the second call with the issue it passed',
      async () => {
        const { session, end } = await tester({ keep_going: true, budget: 20 });
        const first = await end({ issues: [ISSUE] });
        if (first.isError) throw new Error(first.text);
        expect(first.data.ended).toBe(false);
        expect(first.data.left.cases).toEqual(['sort-price']);
        expect(first.data.left.controls.map((c) => c.name).sort()).toEqual([
          'Shipping details',
          'Sort by',
        ]);
        expect(first.data.steps_remaining).toBe(19);
        expect(first.data.todo).toContain('sort-price');
        // Nothing of an ended session is in the answer.
        expect(first.data).not.toHaveProperty('issues_found');

        // It is still a session: it acts, and then ends.
        await session.ok({ type: 'click', ref: await session.ref('details') });
        const second = await end();
        if (second.isError) throw new Error(second.text);
        expect(second.data).not.toHaveProperty('ended');
        expect(second.data.step_count).toBe(2);
        expect(second.data.issues_found.map((i) => i.description)).toEqual([
          ISSUE.description,
        ]);
      },
    );

    gate(
      'F1.2',
      'R-F2',
      'not asked to keep going, the same session ends at the first call',
      async () => {
        const { end } = await tester({ budget: 20 });
        const first = await end();
        if (first.isError) throw new Error(first.text);
        expect(first.data).not.toHaveProperty('ended');
        expect(first.data.step_count).toBe(1);
      },
    );

    gate(
      'F1.3',
      'R-F2',
      'asked to keep going, a session ends at the first call when its budget is nearly spent, or when nothing is left to do',
      async () => {
        // One action of a budget of one: nothing left to spend.
        const spent = await tester({ keep_going: true, budget: 1 });
        const ended = await spent.end();
        if (ended.isError) throw new Error(ended.text);
        expect(ended.data).not.toHaveProperty('ended');

        // Its one case closed, and two controls unused: nothing to hold it
        // back for.
        const done = await tester({ keep_going: true, budget: 20 });
        const closed = await ctx.haunt.call('haunt_plan', {
          session_id: done.session.id,
          brief: true,
          close: [{ id: 'sort-price', verdict: 'passed', note: 'They do.' }],
        });
        if (closed.isError) throw new Error(closed.text);
        const finished = await done.end();
        if (finished.isError) throw new Error(finished.text);
        expect(finished.data).not.toHaveProperty('ended');
        expect(finished.data.step_count).toBe(1);
      },
    );
  });

  describe('F2 one tester that plans what it has seen', () => {
    gate(
      'F2.1',
      'R-F4',
      'no planner in the plugin: one tester per area, which sees the area, plans by the method held word for word, then plays',
      async () => {
        const read = (path: string) =>
          readFileSync(join(REPO_ROOT, path), 'utf-8');
        expect(existsSync(join(REPO_ROOT, 'agents/haunt-planner.md'))).toBe(
          false,
        );
        const command = read('commands/haunt-test.md');
        expect(command).not.toContain('haunt-planner');
        expect(command).toContain('haunt-tester');
        expect(command).toContain('One tester per area');
        expect(command).toMatch(/--steps`[^\n]*\(default: 60\)/);

        const agent = read('agents/haunt-tester.md');
        const tools = (/^tools:\s*(.+)$/m.exec(agent)?.[1] ?? '')
          .split(',')
          .map((tool) => tool.trim().replace(/^.*__/, ''));
        for (const tool of [
          'haunt_spawn',
          'haunt_capture_state',
          'haunt_act',
          'haunt_plan',
          'haunt_end_session',
        ]) {
          expect(tools, tool).toContain(tool);
        }
        expect(agent).toContain(TESTER_BRIEF);
        expect(agent).toContain(CASE_METHOD);
        // Its own steps, in the order they are taken.
        const run = agent.slice(agent.indexOf('## In this run'));
        const at = [
          'See the whole area',
          'Take the inventory and plan',
          'Play the cases',
        ].map((step) => run.indexOf(step));
        expect(
          at.every((index) => index > -1),
          JSON.stringify(at),
        ).toBe(true);
        expect([...at].sort((a, b) => a - b)).toEqual(at);
        // And nothing of a plan taken from another session.
        expect(run).not.toContain('planner');
      },
    );
  });

  describe('F9 the gate is not lying', () => {
    gate(
      'F9.1',
      'R-F3',
      'every requirement of the specification is claimed here, and no test is skipped',
      async () => {
        const source = readdirSync(HERE)
          .filter((f) => /^f\d.*\.test\.ts$/.test(f))
          .map((f) => readFileSync(join(HERE, f), 'utf-8'))
          .join('\n');
        const claimed = new Set(
          [...source.matchAll(/gate\(\s*'F\d+\.\d+',\s*'([^']+)'/g)].flatMap(
            (m) => m[1].split(/\s+/),
          ),
        );
        const required = [
          ...new Set(readFileSync(SPEC, 'utf-8').match(/\bR-F\d+\b/g)),
        ].sort();
        expect(required.filter((id) => !claimed.has(id))).toEqual([]);
        for (const marker of ['skip', 'only', 'todo', 'skipIf', 'runIf']) {
          expect(source.includes(`.${marker}(`), marker).toBe(false);
        }
      },
    );
  });
});
