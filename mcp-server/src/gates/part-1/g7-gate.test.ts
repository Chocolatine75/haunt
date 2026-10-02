// G7 — the gate is not lying.
//
// A gate that cannot fail proves nothing. G7.1 breaks the implementation on
// purpose, one way at a time, and requires the gate to notice each time.
// G7.3 and G7.4 keep the gate's own bookkeeping honest. (G7.2, twenty green
// runs in a row on each system, is `npm run gate:soak`, not a test.)
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { REF_IN_TEXT } from './contract.js';
import { type GateContext, gate, useGauntlet } from './harness.js';
import { PASSING } from './status.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SPEC = resolve(HERE, '../../../../docs/v3/part-1-actions.md');

// The engine's test-only switch. Resolved at run time because the module does
// not exist until the implementation does.
const SABOTAGE_MODULE = '../../engine/sabotage.js';
async function sabotage(name: string | null): Promise<void> {
  const module = await import(/* @vite-ignore */ SABOTAGE_MODULE);
  module.setSabotage(name);
}

// One deliberate breakage, and the smallest check that must catch it. Each
// check passes on a correct implementation and must throw under its sabotage.
const SABOTAGES: Record<string, (ctx: GateContext) => Promise<void>> = {
  // Clicks dispatched by script instead of a real pointer event.
  scripted_click: async (ctx) => {
    const s = await ctx.open('dupes');
    await s.ok({ type: 'click', ref: await s.ref('more-pricing') });
    const [click] = await s.events('click');
    expect(click.detail.trusted).toBe(true);
  },
  // A stale reference quietly resolved to whatever now has the same name.
  stale_resolved_by_name: async (ctx) => {
    const s = await ctx.open('dynamic');
    const old = await s.ref('contact-ada');
    await s.page.locator('[data-g=filter]').press('a');
    const result = await s.act({ type: 'click', ref: old });
    expect(result.results[0].error?.code).toBe('stale_ref');
    expect(await s.events('opened')).toEqual([]);
  },
  // Returning before the page has settled.
  no_settling: async (ctx) => {
    const s = await ctx.open('spa');
    const result = await s.act({ type: 'click', ref: await s.ref('nav-slow') });
    expect(result.diff.added.map((e) => e.name)).toContain('Download report');
  },
  // Acting without checking that the element can receive the action.
  no_actionability_check: async (ctx) => {
    const s = await ctx.open('overlays', 'case=modal');
    const result = await s.act({ type: 'click', ref: await s.ref('target') });
    expect(result.results[0].error?.code).toBe('covered');
    expect(await s.clicks()).toEqual([]);
  },
  // Elements in closed shadow roots left out of the snapshot.
  closed_shadow_dropped: async (ctx) => {
    const s = await ctx.open('shadow');
    const { elements } = await s.snapshot();
    expect(
      elements.some((e) => e.attributes?.['data-g'] === 'closed-save'),
    ).toBe(true);
    expect(
      elements.some((e) => e.attributes?.['data-g'] === 'deep-button'),
    ).toBe(true);
  },
  // The snapshot cut at a character count instead of an element boundary.
  cut_mid_element: async (ctx) => {
    const s = await ctx.open('huge');
    const { text } = await s.capture({ format: 'text', actionable_only: true });
    for (const line of text.split('\n')) {
      if (/^\s*- /.test(line)) expect(line).toMatch(/\[e\d+\]/);
    }
    expect([...text.matchAll(REF_IN_TEXT)].length).toBeGreaterThan(50);
  },
  // "ok" reported for a click that landed on something else.
  ok_on_covered: async (ctx) => {
    const s = await ctx.open('overlays', 'case=glass');
    const result = await s.act({ type: 'click', ref: await s.ref('target') });
    expect(result.results[0].ok).toBe(false);
    expect(await s.status()).toBe('');
  },
  // A reference number handed out a second time.
  reference_reused: async (ctx) => {
    const s = await ctx.open('dynamic');
    const issued = new Set((await s.snapshot()).elements.map((e) => e.ref));
    for (const key of ['a', 'Backspace', 'd']) {
      await s.page.locator('[data-g=filter]').press(key);
      for (const e of (await s.snapshot()).elements) {
        if (e.attributes?.['data-g']?.startsWith('contact-')) {
          expect(issued.has(e.ref)).toBe(false);
        }
        issued.add(e.ref);
      }
    }
  },
  // Redaction decided by the label only, ignoring the element's type.
  redaction_by_label_only: async (ctx) => {
    const s = await ctx.open('forms');
    await s.ok({
      type: 'fill',
      ref: await s.ref('secret-answer'),
      text: 'Rex-7731',
    });
    expect(JSON.stringify(await s.snapshot())).not.toContain('Rex-7731');
  },
  // A tab opened by the page escaping the sandbox.
  new_tab_unsandboxed: async (ctx) => {
    const s = await ctx.open('escape');
    const before = ctx.gauntlet.requests.other.length;
    await s.act({ type: 'click', ref: await s.ref('same-origin-tab') });
    await s.act({ type: 'tab', op: 'switch', index: 1 });
    await s.act({ type: 'goto', url: `${ctx.gauntlet.otherUrl}/tabs/child` });
    expect(ctx.gauntlet.requests.other.slice(before)).toEqual([]);
  },
};

function gateFiles(): Array<{ file: string; source: string }> {
  return readdirSync(HERE)
    .filter((f) => /^g\d.*\.test\.ts$/.test(f))
    .map((file) => ({ file, source: readFileSync(join(HERE, file), 'utf-8') }));
}

// Every gate(...) registration in the gate files: its id and requirements.
function registrations(): Array<{ id: string; requirements: string[] }> {
  const found: Array<{ id: string; requirements: string[] }> = [];
  for (const { source } of gateFiles()) {
    for (const match of source.matchAll(
      /gate\(\s*'(G\d+\.\d+[a-z]?)',\s*'([^']+)'/g,
    )) {
      found.push({ id: match[1], requirements: match[2].split(/\s+/) });
    }
  }
  return found;
}

describe('G7 the gate itself', () => {
  const ctx = useGauntlet();

  afterEach(async () => {
    await sabotage(null).catch(() => {});
  });

  describe('G7.1 sabotage', () => {
    for (const [name, check] of Object.entries(SABOTAGES)) {
      gate(
        'G7.1',
        'R-B3 R-A8 R-C4 R-B2 R-A3 R-A10 R-D3 R-E2 R-E1',
        `${name}: the check passes normally and fails when the engine is sabotaged`,
        async () => {
          await sabotage(null);
          await check(ctx);

          await sabotage(name);
          let caught = false;
          try {
            await check(ctx);
          } catch {
            caught = true;
          }
          expect(caught, `the gate did not notice "${name}"`).toBe(true);
        },
        60_000,
      );
    }

    gate(
      'G7.1',
      'R-B3',
      'the sabotage switch is off unless a test turns it on',
      async () => {
        const module = await import(/* @vite-ignore */ SABOTAGE_MODULE);
        expect(module.currentSabotage()).toBeNull();
        expect(() => module.setSabotage('not-a-real-sabotage')).toThrow();
      },
    );
  });

  describe('G7.3 every requirement has a gate test', () => {
    gate(
      'G7.3',
      'R-A1',
      'each requirement id in the specification is claimed by at least one gate test',
      async () => {
        const spec = readFileSync(SPEC, 'utf-8');
        const required = [...new Set(spec.match(/\bR-[A-F]\d+\b/g))].sort();
        expect(required.length).toBeGreaterThan(35);

        const claimed = new Set(registrations().flatMap((r) => r.requirements));
        const unclaimed = required.filter((id) => !claimed.has(id));
        expect(unclaimed).toEqual([]);

        // And no test claims a requirement the specification does not have.
        const invented = [...claimed].filter((id) => !required.includes(id));
        expect(invented).toEqual([]);
      },
    );
  });

  describe('G7.4 bookkeeping', () => {
    gate(
      'G7.4',
      'R-A1',
      'status.ts only lists gate ids that exist',
      async () => {
        const ids = new Set(registrations().map((r) => r.id));
        expect(ids.size).toBeGreaterThan(40);
        for (const id of PASSING) expect(ids.has(id), id).toBe(true);
      },
    );

    gate(
      'G7.4',
      'R-A1',
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

  // Reports progress in the test output; the part is accepted at 100%.
  it('progress', () => {
    const ids = [...new Set(registrations().map((r) => r.id))];
    const done = ids.filter((id) => PASSING.has(id));
    console.info(`part 1 gate: ${done.length}/${ids.length} groups passing`);
    expect(done.length).toBeLessThanOrEqual(ids.length);
  });
});
