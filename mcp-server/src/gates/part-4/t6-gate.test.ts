// T6 — the gate is not lying, and nothing regressed (R-T17 … R-T19).
//
// T6.1 breaks the engine on purpose, one property at a time, and requires
// the gate's own check of that property to fail. A sabotage the gate does
// not notice is a hole in the gate.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { EV_LOGIN } from '../../test-support/gauntlet/evidence-routes.js';
import { type TesterContext, gate, useTester } from './harness.js';
import { PASSING } from './status.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SPEC = resolve(HERE, '../../../../docs/v3/part-4-tester.md');

// Imported by name at run time: the module must not be a static dependency
// of a file that also has to run before the sabotages exist.
const SABOTAGE_MODULE = '../../engine/sabotage.js';
async function sabotage(name: string | null): Promise<void> {
  const module = await import(/* @vite-ignore */ SABOTAGE_MODULE);
  module.setSabotage(name);
}

// Each sabotage, with the check of the gate that must catch it.
const SABOTAGES: Record<string, (ctx: TesterContext) => Promise<void>> = {
  // The inventory leaves out what a user cannot act on now.
  tester_hidden_dropped: async (ctx) => {
    const session = await ctx.qa('qa-dialog');
    const { inventory } = await session.plan();
    expect(inventory).toHaveLength(session.truth.controls.length);
  },
  // A control named by a case counts as exercised.
  tester_coverage_by_plan: async (ctx) => {
    const session = await ctx.qa('qa-search');
    const plan = await session.register();
    expect(plan.coverage.controls.exercised).toBe(0);
  },
  // An expectation holds whatever the page shows.
  tester_expectation_assumed: async (ctx) => {
    const session = await ctx.qa('qa-sort');
    await session.register();
    const result = await session.play(session.truth.cases[0]);
    expect(result.expectation?.held).toBe(false);
  },
  // A list is read from the page's text, whatever container was named.
  tester_list_unscoped: async (ctx) => {
    const session = await ctx.qa('qa-search', 'clean');
    const result = await session.act([{ type: 'read' }], {
      expect: {
        list: {
          within: { role: 'list', name: 'No such list' },
          items: 'heading',
          count: { eq: 0 },
        },
      },
    });
    expect(result.expectation).toEqual({ held: true, read: [] });
  },
  // The budget is not enforced.
  tester_budget_ignored: async (ctx) => {
    const session = await ctx.qa('qa-search', 'buggy', { budget: 2 });
    const ref = await session.ref('titles-only');
    await session.act([{ type: 'check', ref, checked: true }]);
    await session.act([{ type: 'check', ref, checked: false }]);
    const third = await ctx.haunt.call('haunt_act', {
      session_id: session.id,
      actions: [{ type: 'check', ref, checked: true }],
    });
    expect(third.isError).toBe(true);
  },
  // A credential field's value is read in clear.
  tester_secret_read: async (ctx) => {
    const session = await ctx.ev('ev-login');
    const password = await session.s.s.ref('password');
    const result = await ctx.haunt.call<{
      expectation?: { read?: unknown };
    }>('haunt_act', {
      session_id: session.s.s.id,
      actions: [{ type: 'fill', ref: password, text: EV_LOGIN.password }],
      expect: { value: { ref: password, of: 'value', is: '(filled)' } },
    });
    expect(result.data.expectation?.read).toBe('(filled)');
  },
  // An unchecked issue is counted as a confirmed one.
  tester_unchecked_confirmed: async (ctx) => {
    const session = await ctx.qa('qa-rating');
    await session.act([{ type: 'click', ref: await session.ref('refresh') }]);
    const ended = await session.end([session.issue()]);
    expect(ended.issues_found[0]?.verification.status).toBe('unchecked');
  },
  // An issue naming a failed case is confirmed without a replay.
  tester_case_not_replayed: async (ctx) => {
    const session = await ctx.qa('qa-search', 'clean');
    await session.register();
    await session.playAll();
    const ended = await session.end([session.issue({ case: 'titles-only' })]);
    expect(ended.issues_found).toEqual([]);
  },
};

function gateFiles(): Array<{ file: string; source: string }> {
  return readdirSync(HERE)
    .filter((f) => /^t\d.*\.test\.ts$/.test(f))
    .map((file) => ({ file, source: readFileSync(join(HERE, file), 'utf-8') }));
}

// Every gate(...) registration in the gate files: its id and requirements.
function registrations(): Array<{ id: string; requirements: string[] }> {
  const found: Array<{ id: string; requirements: string[] }> = [];
  for (const { source } of gateFiles()) {
    for (const match of source.matchAll(
      /gate\(\s*(?:\/\/[^\n]*\n\s*)?(?:[^,]*\? )?'(T\d+\.\d+[a-z]?)'(?: : '(T\d+\.\d+[a-z]?)')?,\s*'([^']+)'/g,
    )) {
      for (const id of [match[1], match[2]]) {
        if (id) found.push({ id, requirements: match[3].split(/\s+/) });
      }
    }
  }
  return found;
}

// The numbered items of the spec's "Gate suites" section: T1.1, T1.2, …
// T7 is run by hand and has none.
function specified(spec: string): string[] {
  const ids: string[] = [];
  let suite = '';
  for (const line of spec.split('\n')) {
    const heading = /^### (T\d+) /.exec(line);
    if (heading) suite = heading[1];
    else if (/^#{1,2} /.test(line)) suite = '';
    const item = /^(\d+)\. /.exec(line);
    if (suite && item) ids.push(`${suite}.${item[1]}`);
  }
  return ids;
}

// The files of an earlier gate but its harness, which a later part may add
// to.
function hashOf(dir: string): { files: number; hash: string } {
  const files = readdirSync(dir)
    .filter((f) => f !== 'harness.ts')
    .sort();
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    hash.update(
      readFileSync(join(dir, file), 'utf-8').replaceAll('\r\n', '\n'),
    );
  }
  return { files: files.length, hash: hash.digest('hex') };
}

describe('T6 the gate itself', () => {
  const ctx = useTester();

  afterEach(async () => {
    await sabotage(null).catch(() => {});
  });

  describe('T6.1 sabotage', () => {
    for (const name of Object.keys(SABOTAGES)) {
      gate(
        // Listed apart in status.ts: it waits on R-T11, the others do not.
        name === 'tester_unchecked_confirmed' ? 'T6.1b' : 'T6.1',
        'R-T19',
        `${name}: the check passes normally and fails when the engine is sabotaged`,
        async () => {
          await sabotage(null);
          await SABOTAGES[name](ctx);

          await sabotage(name);
          let caught = false;
          try {
            await SABOTAGES[name](ctx);
          } catch {
            caught = true;
          }
          await ctx.discard();
          expect(caught, `the gate did not notice "${name}"`).toBe(true);
        },
        300_000,
      );
    }
  });

  describe('T6.2 every requirement has a gate test', () => {
    gate(
      'T6.2',
      'R-T19',
      'each requirement id in the specification is claimed by at least one gate test',
      async () => {
        const spec = readFileSync(SPEC, 'utf-8');
        const required = [...new Set(spec.match(/\bR-T\d+\b/g))].sort();
        expect(required).toHaveLength(23);
        const claimed = new Set(registrations().flatMap((r) => r.requirements));
        // R-T17 is proved by the earlier gates running, and by T6.3. R-T18
        // by the gate going through the tools as a host does, and by the
        // tests that check dist/ and the command against src/.
        claimed.add('R-T17');
        claimed.add('R-T18');
        expect(required.filter((id) => !claimed.has(id))).toEqual([]);
        expect([...claimed].filter((id) => !required.includes(id))).toEqual([]);
      },
    );

    gate(
      'T6.2',
      'R-T19',
      'each numbered test of the specification’s gate exists, and no other',
      async () => {
        const wanted = specified(readFileSync(SPEC, 'utf-8')).sort();
        expect(wanted.length).toBeGreaterThanOrEqual(24);
        const ids = new Set(
          registrations().map((r) => r.id.replace(/[a-z]$/, '')),
        );
        expect([...ids].sort()).toEqual(wanted);
      },
    );

    gate(
      'T6.2',
      'R-T19',
      'status.ts only lists gate ids that exist',
      async () => {
        const ids = new Set(registrations().map((r) => r.id));
        for (const id of PASSING) expect(ids.has(id), id).toBe(true);
      },
    );

    gate(
      'T6.2',
      'R-T19',
      'no gate test is skipped, focused or marked todo',
      async () => {
        for (const { file, source } of gateFiles()) {
          const banned = ['skip', 'only', 'todo', 'skipIf', 'runIf'].map(
            (m) => `.${m}(`,
          );
          for (const marker of banned) {
            expect(source.includes(marker), `${file} uses ${marker}`).toBe(
              false,
            );
          }
        }
      },
    );
  });

  describe('T6.3 the earlier gates', () => {
    gate(
      'T6.3',
      'R-T17',
      'the part 1, 2 and 3 gates’ tests, contracts and statuses are what they were when part 4 started',
      async () => {
        expect(hashOf(resolve(HERE, '../part-1'))).toEqual({
          files: 10,
          hash: '5fdb1b72f30ba98661a02f7d58d698b1b6e26edcad5c004badada82e3cfc59b9',
        });
        expect(hashOf(resolve(HERE, '../part-2'))).toEqual({
          files: 12,
          hash: '794fce66dc89a49d831d8193a9acf57a64f8b39721f4e503f3245a920670423e',
        });
        expect(hashOf(resolve(HERE, '../part-3'))).toEqual({
          files: 10,
          hash: 'cd7c100be3530a57ba1e762e3e81bbeae5e8909880a26b5541424a41b2dbd002',
        });
      },
    );
  });

  // Reports progress in the test output; the part is accepted at 100%.
  it('progress', () => {
    const ids = [...new Set(registrations().map((r) => r.id))];
    const done = ids.filter((id) => PASSING.has(id));
    console.info(`part 4 gate: ${done.length}/${ids.length} groups passing`);
    expect(done.length).toBeLessThanOrEqual(ids.length);
  });
});
