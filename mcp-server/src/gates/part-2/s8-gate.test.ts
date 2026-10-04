// S8 — the gate is not lying, and nothing regressed.
//
// S8.1 breaks the implementation on purpose, one way at a time, and requires
// the gate to notice each time. S8.2 keeps the gate's own bookkeeping
// honest. S8.3 pins part 1's gate. (S8.4, the time budget, is in
// s8-overhead.perf.test.ts.)
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type SignalContext,
  TOUR_SECRET,
  TRUTH,
  gate,
  pathOf,
  useSignals,
} from './harness.js';
import { PASSING } from './status.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SPEC = resolve(HERE, '../../../../docs/v3/part-2-signals.md');
const PART_1 = resolve(HERE, '../part-1');

// The engine's test-only switch (see part 1's G7).
const SABOTAGE_MODULE = '../../engine/sabotage.js';
async function sabotage(name: string | null): Promise<void> {
  const module = await import(/* @vite-ignore */ SABOTAGE_MODULE);
  module.setSabotage(name);
}

// One deliberate breakage, and the smallest check that must catch it. Each
// check passes on a correct implementation and must throw under its sabotage.
const SABOTAGES: Record<string, (ctx: SignalContext) => Promise<void>> = {
  // A signal that arrives after its action's result is thrown away.
  signals_late_dropped: async (ctx) => {
    const s = await ctx.sig('sig-exceptions');
    await s.click('throw-after-settle');
    await s.wait(3_000);
    expect(s.delivered.map((x) => x.message).join('\n')).toContain(
      'Chart export failed',
    );
  },
  // Everything attributed to the step running when it arrived.
  signals_latest_step: async (ctx) => {
    const s = await ctx.sig('sig-exceptions');
    const first = await s.click('throw-after-settle');
    await s.click('log-error');
    await s.wait(3_000);
    const late = s.delivered.find((x) =>
      x.message.includes('Chart export failed'),
    );
    expect(late?.step).toBe(first.step);
  },
  // A sandbox block reported as a failed request.
  signals_sandbox_blocks: async (ctx) => {
    const s = await ctx.part1('escape');
    await s.click('fetch');
    await s.wait(400);
    expect(s.delivered).toEqual([]);
  },
  // Every occurrence its own signal.
  signals_no_dedup: async (ctx) => {
    const s = await ctx.sig('sig-http');
    const result = await s.click('refresh-prices');
    const mine = result.signals.filter((x) => x.step === result.step);
    expect(mine.map((x) => x.count)).toEqual([20]);
  },
  // The browser's console line about a failed request counted as well.
  signals_console_line: async (ctx) => {
    const s = await ctx.sig('sig-http');
    const result = await s.click('load-orders');
    expect(result.signals.map((x) => x.kind)).toEqual(['http_error']);
  },
  // Only server errors counted as HTTP errors.
  signals_ignore_4xx: async (ctx) => {
    const s = await ctx.sig('sig-http');
    const result = await s.click('load-profile');
    expect(
      result.signals.map((x) =>
        x.kind === 'http_error' ? [x.status, pathOf(x.request_url)] : x.kind,
      ),
    ).toEqual([[404, '/sig/api/profile']]);
  },
  // No audit at all.
  signals_no_audit: async (ctx) => {
    const s = await ctx.sig('sig-a11y');
    expect(s.atSpawn.filter((x) => x.kind === 'a11y')).toHaveLength(
      TRUTH['sig-a11y'].load.length,
    );
  },
  // The page audited again after every action.
  signals_audit_every_action: async (ctx) => {
    const s = await ctx.sig('sig-a11y');
    const result = await s.act({ type: 'read' }, { type: 'read' });
    expect(result.signals.filter((x) => x.kind === 'a11y')).toEqual([]);
  },
  // What was typed into a credential field left in the messages.
  signals_secrets_kept: async (ctx) => {
    const s = await ctx.sig('sig-secrets');
    await s.act({
      type: 'fill',
      ref: await s.s.ref('password'),
      text: TOUR_SECRET,
    });
    const result = await s.click('in-message');
    expect(result.signals).toHaveLength(1);
    expect(JSON.stringify(result.signals)).not.toContain(TOUR_SECRET);
  },
  // What the last action caused, lost when the session ends.
  signals_end_dropped: async (ctx) => {
    const s = await ctx.sig('sig-exceptions');
    await s.click('throw-after-settle');
    const ended = await s.end();
    expect(ended.map((x) => x.message).join('\n')).toContain(
      'Chart export failed',
    );
  },
};

function gateFiles(): Array<{ file: string; source: string }> {
  return readdirSync(HERE)
    .filter((f) => /^s\d.*\.test\.ts$/.test(f))
    .map((file) => ({ file, source: readFileSync(join(HERE, file), 'utf-8') }));
}

// Every gate(...) registration in the gate files: its id and requirements.
function registrations(): Array<{ id: string; requirements: string[] }> {
  const found: Array<{ id: string; requirements: string[] }> = [];
  for (const { source } of gateFiles()) {
    for (const match of source.matchAll(
      /gate\(\s*'(S\d+\.\d+[a-z]?)',\s*'([^']+)'/g,
    )) {
      found.push({ id: match[1], requirements: match[2].split(/\s+/) });
    }
  }
  return found;
}

// The gate's numbered tests in the specification: "### S3 — …" then "1. …".
function specified(spec: string): string[] {
  const ids: string[] = [];
  let suite = '';
  for (const line of spec.split('\n')) {
    const heading = /^### (S\d+) /.exec(line);
    if (heading) suite = heading[1];
    else if (/^#{1,2} /.test(line)) suite = '';
    const item = /^(\d+)\. /.exec(line);
    if (suite && item) ids.push(`${suite}.${item[1]}`);
  }
  return ids;
}

describe('S8 the gate itself', () => {
  const ctx = useSignals();

  afterEach(async () => {
    await sabotage(null).catch(() => {});
  });

  describe('S8.1 sabotage', () => {
    const breaks = (name: string) => async () => {
      await sabotage(null);
      await SABOTAGES[name](ctx);

      await sabotage(name);
      let caught = false;
      try {
        await SABOTAGES[name](ctx);
      } catch {
        caught = true;
      }
      // What the broken engine produced is not for the harness to judge.
      await ctx.discard();
      expect(caught, `the gate did not notice "${name}"`).toBe(true);
    };
    const title = (name: string) =>
      `${name}: the check passes normally and fails when the engine is sabotaged`;
    const names = Object.keys(SABOTAGES);

    for (const name of names.filter((n) => !n.includes('audit'))) {
      gate(
        'S8.1',
        'R-S7 R-S6 R-S11 R-S13 R-S2 R-S18 R-S8',
        title(name),
        breaks(name),
        60_000,
      );
    }
    // The two about the audit pass with it, after the others.
    for (const name of names.filter((n) => n.includes('audit'))) {
      gate('S8.1b', 'R-S15', title(name), breaks(name), 60_000);
    }
  });

  describe('S8.2 every requirement has a gate test', () => {
    gate(
      'S8.2',
      'R-S1',
      'each requirement id in the specification is claimed by at least one gate test',
      async () => {
        const spec = readFileSync(SPEC, 'utf-8');
        const required = [...new Set(spec.match(/\bR-S\d+\b/g))].sort();
        expect(required).toHaveLength(25);

        const claimed = new Set(registrations().flatMap((r) => r.requirements));
        expect(required.filter((id) => !claimed.has(id))).toEqual([]);
        // And no test claims a requirement the specification does not have.
        expect([...claimed].filter((id) => !required.includes(id))).toEqual([]);
      },
    );

    gate(
      'S8.2',
      'R-S1',
      'each numbered test of the specification’s gate exists, and no other',
      async () => {
        const wanted = specified(readFileSync(SPEC, 'utf-8')).sort();
        expect(wanted.length).toBeGreaterThan(30);
        // A letter only splits a numbered test in two for status.ts.
        const ids = new Set(
          registrations().map((r) => r.id.replace(/[a-z]$/, '')),
        );
        expect([...ids].sort()).toEqual(wanted);
      },
    );

    gate(
      'S8.2',
      'R-S1',
      'status.ts only lists gate ids that exist',
      async () => {
        const ids = new Set(registrations().map((r) => r.id));
        for (const id of PASSING) expect(ids.has(id), id).toBe(true);
      },
    );

    gate(
      'S8.2',
      'R-S1',
      'no gate test is skipped, focused or marked todo',
      async () => {
        for (const { file, source } of gateFiles()) {
          // Assembled so this file does not match itself.
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

  describe('S8.3 the part 1 gate', () => {
    gate(
      'S8.3',
      'R-S24',
      'the part 1 gate’s tests, contract and status are what they were when part 2 started',
      async () => {
        // Whether they pass is for the run to say: they are in the same
        // `npm run gate`. This says they were not loosened to get there.
        // The harness is left out: part 2 adds a check to it (S2.3).
        const files = readdirSync(PART_1)
          .filter((f) => f !== 'harness.ts')
          .sort();
        const hash = createHash('sha256');
        for (const file of files) {
          hash.update(file);
          // Line endings differ from one system's checkout to another's.
          hash.update(
            readFileSync(join(PART_1, file), 'utf-8').replaceAll('\r\n', '\n'),
          );
        }
        expect(files).toHaveLength(10);
        expect(hash.digest('hex')).toBe(PART_1_HASH);
      },
    );
  });

  // Reports progress in the test output; the part is accepted at 100%.
  it('progress', () => {
    const ids = [...new Set(registrations().map((r) => r.id))];
    const done = ids.filter((id) => PASSING.has(id));
    console.info(`part 2 gate: ${done.length}/${ids.length} groups passing`);
    expect(done.length).toBeLessThanOrEqual(ids.length);
  });
});

// Updated once since part 2 started, for G1.2 waiting on its late frame
// rather than on a fixed second (#37): the assertions did not change.
const PART_1_HASH =
  '5fdb1b72f30ba98661a02f7d58d698b1b6e26edcad5c004badada82e3cfc59b9';
