// E7 — the gate is not lying, and nothing regressed (R-E19).
//
// E7.1 breaks the implementation on purpose, one way at a time, and
// requires the gate to notice each time. E7.2 keeps the gate's own
// bookkeeping honest. E7.3 pins the earlier gates. (E7.4, the time budget,
// is in e7-overhead.perf.test.ts.)
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { EV_LOGIN } from '../../test-support/gauntlet/evidence-routes.js';
import type { StepsFile } from './contract.js';
import {
  type EvidenceContext,
  gate,
  readJson,
  useEvidence,
  zipEntries,
} from './harness.js';
import { PASSING } from './status.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SPEC = resolve(HERE, '../../../../docs/v3/part-3-evidence.md');

// The engine's test-only switch (see part 1's G7).
const SABOTAGE_MODULE = '../../engine/sabotage.js';
async function sabotage(name: string | null): Promise<void> {
  const module = await import(/* @vite-ignore */ SABOTAGE_MODULE);
  module.setSabotage(name);
}

// One deliberate breakage, and the smallest check that must catch it.
const SABOTAGES: Record<string, (ctx: EvidenceContext) => Promise<void>> = {
  // Steps recorded with the session's references instead of locators.
  evidence_refs_not_locators: async (ctx) => {
    const s = await ctx.ev('ev-sequence');
    await s.play();
    const [issue] = (await s.end()).issues_found;
    const bundle = issue.verification.bundle as string;
    expect((await ctx.replay({ bundle })).outcome).toBe('reproduced');
  },
  // An action that failed in the session replayed anyway.
  evidence_failed_replayed: async (ctx) => {
    const s = await ctx.ev('ev-sequence');
    await s.s.act({ type: 'click', ref: 'e9999' });
    await s.play();
    const [issue] = (await s.end()).issues_found;
    const steps = readJson<StepsFile>(
      join(issue.verification.bundle as string, 'steps.json'),
    );
    expect(steps.steps).toHaveLength(3);
  },
  // One replay taken as confirmation.
  evidence_one_replay: async (ctx) => {
    const s = await ctx.ev('ev-sequence');
    await s.play();
    const [issue] = (await s.end()).issues_found;
    expect(issue.verification.attempts).toBe(3);
  },
  // A flaky issue reported as confirmed.
  evidence_flaky_as_confirmed: async (ctx) => {
    const s = await ctx.ev('ev-flaky');
    await s.play();
    const [issue] = (await s.end()).issues_found;
    expect(issue.verification.status).toBe('flaky');
  },
  // A rejected issue reported all the same.
  evidence_rejected_reported: async (ctx) => {
    const s = await ctx.ev('ev-sequence');
    await s.play();
    const [issue] = s.issues();
    const ended = await s.end([{ ...issue, signal: undefined }]);
    expect(ended.issues_found).toEqual([]);
  },
  // The password left in the trace.
  evidence_secrets_in_trace: async (ctx) => {
    const s = await ctx.ev('ev-login');
    await s.play();
    const [issue] = (await s.end()).issues_found;
    const trace = join(issue.verification.bundle as string, 'trace.zip');
    for (const [, data] of zipEntries(trace)) {
      expect(data.toString('latin1')).not.toContain(EV_LOGIN.password);
    }
  },
  // Credential fields photographed as they are.
  evidence_screenshots_unmasked: async (ctx) => {
    const s = await ctx.ev('ev-login');
    const shoot = () => s.screenshot('sign-in');
    const empty = await shoot();
    await s.play(s.truth.steps.slice(0, 2));
    expect((await shoot()).equals(empty)).toBe(true);
  },
  // The storage cap not applied.
  evidence_cap_ignored: async (ctx) => {
    const s = await ctx.ev('ev-sequence', 'buggy', {
      bundle_cap_bytes: 20_000,
    });
    await s.play();
    const [issue] = (await s.end()).issues_found;
    const bundle = issue.verification.bundle as string;
    expect(readdirSync(bundle)).not.toContain('trace.zip');
  },
  // Replays run in the session's own browser, where it is still signed in.
  evidence_same_session: async (ctx) => {
    const s = await ctx.ev('ev-login');
    await s.play();
    const [issue] = (await s.end()).issues_found;
    expect(issue?.verification.status).toBe('confirmed');
  },
};

function gateFiles(): Array<{ file: string; source: string }> {
  return readdirSync(HERE)
    .filter((f) => /^e\d.*\.test\.ts$/.test(f))
    .map((file) => ({ file, source: readFileSync(join(HERE, file), 'utf-8') }));
}

// Every gate(...) registration in the gate files: its id and requirements.
function registrations(): Array<{ id: string; requirements: string[] }> {
  const found: Array<{ id: string; requirements: string[] }> = [];
  for (const { source } of gateFiles()) {
    for (const match of source.matchAll(
      /gate\(\s*'(E\d+\.\d+[a-z]?)',\s*'([^']+)'/g,
    )) {
      found.push({ id: match[1], requirements: match[2].split(/\s+/) });
    }
  }
  return found;
}

// The gate's numbered tests in the specification: "### E3 — …" then "1. …".
function specified(spec: string): string[] {
  const ids: string[] = [];
  let suite = '';
  for (const line of spec.split('\n')) {
    const heading = /^### (E\d+) /.exec(line);
    if (heading) suite = heading[1];
    else if (/^#{1,2} /.test(line)) suite = '';
    const item = /^(\d+)\. /.exec(line);
    if (suite && item) ids.push(`${suite}.${item[1]}`);
  }
  return ids;
}

// The files of an earlier gate but its harness, which a later part may add
// a check to.
function hashOf(dir: string): { files: number; hash: string } {
  const files = readdirSync(dir)
    .filter((f) => f !== 'harness.ts')
    .sort();
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    // Line endings differ from one system's checkout to another's.
    hash.update(
      readFileSync(join(dir, file), 'utf-8').replaceAll('\r\n', '\n'),
    );
  }
  return { files: files.length, hash: hash.digest('hex') };
}

describe('E7 the gate itself', () => {
  const ctx = useEvidence();

  afterEach(async () => {
    await sabotage(null).catch(() => {});
  });

  describe('E7.1 sabotage', () => {
    for (const name of Object.keys(SABOTAGES)) {
      gate(
        'E7.1',
        'R-E4 R-E6 R-E8 R-E9 R-E15 R-E16',
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

  describe('E7.2 every requirement has a gate test', () => {
    gate(
      'E7.2',
      'R-E19',
      'each requirement id in the specification is claimed by at least one gate test',
      async () => {
        const spec = readFileSync(SPEC, 'utf-8');
        const required = [...new Set(spec.match(/\bR-E\d+\b/g))].sort();
        expect(required).toHaveLength(20);
        const claimed = new Set(registrations().flatMap((r) => r.requirements));
        // R-E20 is the time budget's, in the perf file.
        claimed.add('R-E20');
        expect(required.filter((id) => !claimed.has(id))).toEqual([]);
        expect([...claimed].filter((id) => !required.includes(id))).toEqual([]);
      },
    );

    gate(
      'E7.2',
      'R-E19',
      'each numbered test of the specification’s gate exists, and no other',
      async () => {
        const wanted = specified(readFileSync(SPEC, 'utf-8')).sort();
        expect(wanted.length).toBeGreaterThan(20);
        const ids = new Set(
          registrations().map((r) => r.id.replace(/[a-z]$/, '')),
        );
        // E7.4 is the time budget's, in the perf file.
        ids.add('E7.4');
        expect([...ids].sort()).toEqual(wanted);
      },
    );

    gate(
      'E7.2',
      'R-E19',
      'status.ts only lists gate ids that exist',
      async () => {
        const ids = new Set([...registrations().map((r) => r.id), 'E7.4']);
        for (const id of PASSING) expect(ids.has(id), id).toBe(true);
      },
    );

    gate(
      'E7.2',
      'R-E19',
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

  describe('E7.3 the earlier gates', () => {
    gate(
      'E7.3',
      'R-E19',
      'the part 1 and part 2 gates’ tests, contracts and statuses are what they were when part 3 started',
      async () => {
        expect(hashOf(resolve(HERE, '../part-1'))).toEqual({
          files: 10,
          hash: '3912b2be87ff227958095629be32a1c4601227bb4f2b2581f39d04b4f40f1ef0',
        });
        expect(hashOf(resolve(HERE, '../part-2'))).toEqual({
          files: 12,
          hash: '33b25556926148c60a75b5cbc9c82d4153df3e5d978e61ee7f38ccd15f964c98',
        });
      },
    );
  });

  // Reports progress in the test output; the part is accepted at 100%.
  it('progress', () => {
    const ids = [...new Set([...registrations().map((r) => r.id), 'E7.4'])];
    const done = ids.filter((id) => PASSING.has(id));
    console.info(`part 3 gate: ${done.length}/${ids.length} groups passing`);
    expect(done.length).toBeLessThanOrEqual(ids.length);
  });
});
