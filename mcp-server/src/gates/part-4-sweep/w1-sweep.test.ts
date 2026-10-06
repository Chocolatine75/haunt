// The sweep of the buttons no tester pressed (docs/v3/part-4-sweep.md): the
// engine presses them itself, on the page as it loads, and reports what
// breaks; it presses nothing in a form and nothing that destroys.
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { Variant } from '../../test-support/gauntlet/server.js';
import { useSignals } from '../part-2/harness.js';
import { PASSING } from './status.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const SPEC = join(REPO_ROOT, 'docs/v3/part-4-sweep.md');

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

// What haunt_sweep returns.
interface SweepResult {
  session_id: string;
  pressed: Array<{
    role: string;
    name: string;
    group: string;
    changed: boolean;
    signals: string[];
  }>;
  left: Array<{ role: string; name: string; group: string; why: string }>;
  signals: Array<{
    id: string;
    kind: string;
    message: string;
    severity: string;
    step: number;
    status: string;
    name?: string;
  }>;
}

// The buttons of sw-buttons a sweep may press, in reading order.
const PRESSED = [
  'Refresh',
  'Export',
  'Archive',
  'Open settings',
  'Discard draft',
  'Billing',
  'Attach a file',
  'Add to cart',
];

const SABOTAGE_MODULE = '../../engine/sabotage.js';
async function sabotage(name: string | null): Promise<void> {
  const module = await import(/* @vite-ignore */ SABOTAGE_MODULE);
  module.setSabotage(name);
}

describe('W the sweep of the buttons no tester pressed', () => {
  const ctx = useSignals();
  const written: string[] = [];

  afterEach(async () => {
    await sabotage(null).catch(() => {});
    for (const path of written.splice(0)) rmSync(path, { force: true });
  });

  const url = (variant: Variant) =>
    ctx.gauntlet.url('sw-buttons', `variant=${variant}`);

  async function sweep(
    variant: Variant,
    more: Record<string, unknown> = {},
  ): Promise<SweepResult> {
    const result = await ctx.haunt.call<SweepResult>('haunt_sweep', {
      target_url: url(variant),
      // Replays are W2.1's.
      replay_budget_ms: 0,
      ...more,
    });
    if (result.isError) throw new Error(result.text);
    return result.data;
  }

  // A tester that pressed "Refresh" and ended.
  async function tester(variant: Variant): Promise<string> {
    const session = await ctx.openUrl(url(variant), {});
    await session.ok({ type: 'click', ref: await session.ref('refresh') });
    await session.end();
    return session.id;
  }

  describe('W1 what is pressed, and what it finds', () => {
    gate(
      'W1.1',
      'R-W1 R-W3',
      'buggy: every button that may be pressed is, once, on the page as it loads; the dead one and the one that throws are raised, and nothing else',
      async () => {
        const swept = await sweep('buggy');
        expect(swept.pressed.map((p) => p.name)).toEqual(PRESSED);
        for (const one of swept.pressed) expect(one.role).toBe('button');
        expect(
          swept.signals.map((s) => [s.kind, s.severity]).sort(),
          JSON.stringify(swept.signals),
        ).toEqual([
          ['dead_control', 'major'],
          ['js_exception', 'major'],
        ]);
        const dead = swept.signals.find((s) => s.kind === 'dead_control');
        const thrown = swept.signals.find((s) => s.kind === 'js_exception');
        expect(dead?.name).toBe('Export');
        expect(thrown?.message).toContain('archive store is not ready');
        // Each with the press that brought it.
        const by = (name: string) => swept.pressed.find((p) => p.name === name);
        expect(by('Export')).toMatchObject({
          changed: false,
          signals: [dead?.id],
        });
        expect(by('Archive')?.signals).toEqual([thrown?.id]);
        expect(by('Refresh')).toMatchObject({ changed: true, signals: [] });
        expect(by('Open settings')?.changed).toBe(true);
      },
    );

    gate(
      'W1.2',
      'R-W4',
      'clean: the same buttons are pressed and nothing is raised',
      async () => {
        const swept = await sweep('clean');
        expect(swept.pressed.map((p) => p.name)).toEqual(PRESSED);
        expect(swept.signals).toEqual([]);
        for (const one of swept.pressed) {
          expect(one, one.name).toMatchObject({
            // The file picker is the browser's: nothing changes in the page,
            // and it is not a dead button for that.
            changed: one.name !== 'Attach a file',
            signals: [],
          });
        }
      },
    );

    gate(
      'W1.3',
      'R-W2',
      'what is in a form and what destroys is left alone, and listed with why',
      async () => {
        const swept = await sweep('buggy');
        expect(swept.left.map((l) => [l.name, l.group, l.why]).sort()).toEqual([
          ['Delete account', 'page', 'destructive'],
          ['Subscribe', 'form: Newsletter', 'in a form'],
        ]);
      },
    );

    gate(
      'W1.4',
      'R-W1',
      'a button a session given to the sweep exercised is not pressed again; an unknown session is refused',
      async () => {
        const id = await tester('buggy');
        const swept = await sweep('buggy', { sessions: [id] });
        expect(swept.pressed.map((p) => p.name)).toEqual(
          PRESSED.filter((name) => name !== 'Refresh'),
        );
        const refused = await ctx.haunt.call('haunt_sweep', {
          target_url: url('buggy'),
          sessions: ['no-such-session'],
        });
        expect(refused.isError).toBe(true);
        expect(refused.text).toContain('no-such-session');
      },
    );

    gate(
      'W1.5',
      'R-W2',
      'with a limit of two, two are pressed and the rest are listed as over the limit',
      async () => {
        const swept = await sweep('buggy', { max: 2 });
        expect(swept.pressed.map((p) => p.name)).toEqual(PRESSED.slice(0, 2));
        expect(
          swept.left
            .filter((l) => l.why === 'over the limit')
            .map((l) => l.name),
        ).toEqual(PRESSED.slice(2));
      },
    );
  });

  describe('W1 what the load raises', () => {
    gate(
      'W1.6',
      'R-W4',
      'what a page raises as it loads is in the result once, however many times the sweep opened it again',
      async () => {
        const result = await ctx.haunt.call<SweepResult>('haunt_sweep', {
          target_url: ctx.gauntlet.url('sig-http', 'variant=buggy'),
          replay_budget_ms: 0,
        });
        if (result.isError) throw new Error(result.text);
        const swept = result.data;
        // Each of its buttons shows something: the page was opened again
        // after each.
        expect(swept.pressed.filter((p) => p.changed).length).toBeGreaterThan(
          2,
        );
        const stylesheet = swept.signals.filter((s) =>
          s.message.includes('/sig/asset/theme.css'),
        );
        expect(stylesheet.map((s) => s.step)).toEqual([0]);
        // And what the presses brought is all there.
        expect(swept.signals.filter((s) => s.step > 0).length).toBe(4);
      },
    );
  });

  describe('W2 where it goes', () => {
    gate(
      'W2.1',
      'R-W5',
      'the sweep’s session has ended, and its signals are confirmed by their replays',
      async () => {
        const swept = await sweep('buggy', { replay_budget_ms: 120_000 });
        expect(swept.signals.map((s) => [s.kind, s.status]).sort()).toEqual([
          ['dead_control', 'confirmed'],
          ['js_exception', 'confirmed'],
        ]);
        const acted = await ctx.haunt.call('haunt_act', {
          session_id: swept.session_id,
          actions: [{ type: 'reload' }],
        });
        expect(acted.isError).toBe(true);
      },
      300_000,
    );

    gate(
      'W2.2',
      'R-W5',
      'a report of a tester’s session and the sweep’s lists the dead button, and counts what was pressed as exercised',
      async () => {
        const id = await tester('buggy');
        const swept = await sweep('buggy', { sessions: [id] });
        const result = await ctx.haunt.call<{
          report_path: string;
          markdown: string;
        }>('haunt_generate_report', {
          target_url: url('buggy'),
          date: '2026-05-06',
          sessions: [id, swept.session_id].map((session_id) => ({
            session_id,
            area: '/sw-buttons',
            overall_impression: 'done',
          })),
        });
        if (result.isError) throw new Error(result.text);
        const sidecarPath = result.data.report_path.replace(/\.md$/, '.json');
        written.push(result.data.report_path, sidecarPath);
        const detected = result.data.markdown.split(
          '## Detected automatically',
        )[1];
        expect(detected).toContain('"Export"');
        const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf-8')) as {
          coverage?: {
            controls: { exercised: number };
            left: { controls: Array<{ name: string }> };
          };
        };
        // "Refresh" by the tester, the six others by the sweep.
        expect(sidecar.coverage?.controls.exercised).toBe(PRESSED.length);
        const never = sidecar.coverage?.left.controls.map((c) => c.name) ?? [];
        for (const name of PRESSED) expect(never).not.toContain(name);
        expect(never).toContain('Delete account');
        expect(never).toContain('Subscribe');
      },
    );

    gate(
      'W2.3',
      'R-W6',
      'the command sweeps each area after its testers, and documents how to leave that out',
      async () => {
        const command = readFileSync(
          join(REPO_ROOT, 'commands/haunt-test.md'),
          'utf-8',
        );
        expect(command).toContain('--no-sweep');
        const testers = command.indexOf('One tester per group');
        const sweeping = command.indexOf('haunt_sweep');
        const report = command.indexOf('### Phase 3');
        expect(testers).toBeGreaterThan(-1);
        expect(sweeping).toBeGreaterThan(testers);
        expect(report).toBeGreaterThan(sweeping);
        const { tools } = await ctx.haunt.client.listTools();
        expect(tools.map((tool) => tool.name)).toContain('haunt_sweep');
      },
    );
  });

  describe('W3 the gate is not lying', () => {
    gate(
      'W3.1',
      'R-W7',
      'with forms swept on purpose, the check of what was pressed fails',
      async () => {
        const check = async () => {
          const swept = await sweep('clean');
          expect(swept.pressed.map((p) => p.name)).toEqual(PRESSED);
        };
        await check();
        await sabotage('sweep_forms_included');
        let caught = false;
        try {
          await check();
        } catch {
          caught = true;
        }
        expect(caught, 'the gate did not notice').toBe(true);
      },
    );

    gate(
      'W3.2',
      'R-W7',
      'every requirement of the specification is claimed here, and no test is skipped',
      async () => {
        const source = readdirSync(HERE)
          .filter((f) => /^w\d.*\.test\.ts$/.test(f))
          .map((f) => readFileSync(join(HERE, f), 'utf-8'))
          .join('\n');
        const claimed = new Set(
          [...source.matchAll(/gate\(\s*'W\d+\.\d+',\s*'([^']+)'/g)].flatMap(
            (m) => m[1].split(/\s+/),
          ),
        );
        const required = [
          ...new Set(readFileSync(SPEC, 'utf-8').match(/\bR-W\d+\b/g)),
        ].sort();
        expect(required).toHaveLength(7);
        expect(required.filter((id) => !claimed.has(id))).toEqual([]);
        for (const marker of ['skip', 'only', 'todo', 'skipIf', 'runIf']) {
          expect(source.includes(`.${marker}(`), marker).toBe(false);
        }
      },
    );
  });
});
