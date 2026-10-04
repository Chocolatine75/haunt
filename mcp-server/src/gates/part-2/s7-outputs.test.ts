// S7 — where signals go (R-S19 … R-S23).
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect } from 'vitest';
import { runHeadlessTest } from '../../cli/headless.js';
import type { ActionDecider } from '../../cli/providers/types.js';
import { SessionManager } from '../../engine/session/manager.js';
import { type Action, REF_IN_TEXT } from '../part-1/contract.js';
import {
  type HeadlessVerdict,
  REPORT_SIGNALS_HEADING,
  type ReportSessionInput,
  type ReportSidecar,
  type Signal,
} from './contract.js';
import {
  PERSONA,
  type SignalSession,
  gate,
  pathOf,
  useSignals,
} from './harness.js';

const REPO_ROOT = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../..',
);

const identity = (signals: Signal[]) =>
  signals.map((s) => `${s.id} step ${s.step} ${s.kind}`).sort();

// Without what only says how a signal was delivered.
const settled = (signals: Signal[]) =>
  [...signals]
    .map(({ late: _late, ...rest }) => rest)
    .sort((a, b) => a.id.localeCompare(b.id));

const requestPath = (signal: Signal) =>
  'request_url' in signal ? pathOf(signal.request_url) : undefined;

// The lines of a markdown report under the heading that contains `title`,
// down to the next heading of the same level or above.
function section(markdown: string, title: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => /^#+ /.test(l) && l.includes(title));
  if (start === -1) throw new Error(`no "${title}" section in the report`);
  const level = /^#+/.exec(lines[start])?.[0].length ?? 1;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => new RegExp(`^#{1,${level}} `).test(l));
  return rest.slice(0, end === -1 ? undefined : end).join('\n');
}

describe('S7 where signals go', () => {
  const ctx = useSignals();
  const written: string[] = [];

  // Three clicks on sig-http, each with one signal, on top of the two of
  // the load.
  async function threeFailures(): Promise<SignalSession> {
    const session = await ctx.sig('sig-http');
    for (const control of ['load-orders', 'load-profile', 'subscribe']) {
      await session.click(control);
    }
    return session;
  }

  async function report(sessions: ReportSessionInput[]) {
    const result = await ctx.haunt.call<{
      report_path: string;
      markdown: string;
    }>('haunt_generate_report', {
      target_url: ctx.gauntlet.baseUrl,
      personas: ['gate-s7'],
      sessions,
    });
    if (result.isError) throw new Error(result.text);
    const sidecarPath = result.data.report_path.replace(/\.md$/, '.json');
    const sidecar: ReportSidecar = JSON.parse(
      readFileSync(sidecarPath, 'utf-8'),
    );
    written.push(result.data.report_path, sidecarPath);
    return { markdown: result.data.markdown, sidecar };
  }

  const cleanUp = () => {
    for (const path of written.splice(0)) rmSync(path, { force: true });
  };

  describe('S7.1 the same signals everywhere', () => {
    gate(
      'S7.1',
      'R-S19 R-S20 R-S21',
      'the action results, the session result and the report’s sidecar hold the same signals with the same steps',
      async () => {
        try {
          const session = await threeFailures();
          const delivered = [...session.delivered];
          expect(delivered).toHaveLength(5);
          expect(delivered.map((s) => s.step).sort()).toEqual([0, 0, 1, 2, 3]);

          const ended = await session.end();
          expect(identity(ended)).toEqual(identity(delivered));
          expect(settled(ended)).toEqual(settled(delivered));

          const { sidecar } = await report([
            {
              area: '/sig-http',
              persona: 'gate',
              overall_impression: 'done',
              issues: [],
              signals: ended,
            },
          ]);
          expect(identity(sidecar.signals)).toEqual(identity(delivered));
          expect(settled(sidecar.signals)).toEqual(settled(ended));
          expect(sidecar.signal_counts).toEqual({
            total: 5,
            major: 1,
            minor: 4,
          });
        } finally {
          cleanUp();
        }
      },
    );

    gate(
      'S7.1b',
      'R-S19',
      'haunt_capture_state lists the signals of the current page, delivered or not',
      async () => {
        const session = await threeFailures();
        const listed = await session.capture({ signals: true });
        expect(identity(listed)).toEqual(identity(session.delivered));

        // On another page, only that page's.
        await session.act({
          type: 'goto',
          url: ctx.gauntlet.url('sig-silent', 'variant=buggy'),
        });
        const save = await session.click('save-silent');
        const elsewhere = await session.capture({ signals: true });
        expect(elsewhere.map((s) => [s.kind, s.step])).toEqual([
          ['http_error', save.step],
        ]);
        expect(pathOf(elsewhere[0].url)).toBe('/sig-silent');

        // Asking does not deliver them a second time with the next action.
        const next = await session.act({ type: 'read' });
        expect(next.signals).toEqual([]);
      },
    );

    gate(
      'S7.1b',
      'R-S19',
      'a call that asks for nothing about signals returns the snapshot as before',
      async () => {
        const session = await threeFailures();
        const snapshot = await session.s.capture({ format: 'text' });
        expect('signals' in snapshot).toBe(false);
        expect(snapshot.text).toContain('Load orders');
      },
    );
  });

  describe('S7.2 the report', () => {
    gate(
      'S7.2',
      'R-S21',
      'signals have a section of their own, and an issue that names one absorbs it',
      async () => {
        try {
          const session = await threeFailures();
          const signals = await session.end();
          const orders = signals.find(
            (s) => requestPath(s) === '/sig/api/orders',
          );
          if (!orders) throw new Error('no signal for /sig/api/orders');

          const { markdown, sidecar } = await report([
            {
              area: '/sig-http',
              persona: 'gate',
              overall_impression: 'done',
              issues: [
                {
                  severity: 'critical',
                  category: 'ux',
                  description: 'The list of orders cannot be loaded at all',
                  page_url: ctx.gauntlet.url('sig-http'),
                  recommendation: 'Fix the orders endpoint',
                  signal: orders.id,
                },
              ],
              signals,
            },
          ]);

          const automatic = section(markdown, REPORT_SIGNALS_HEADING);
          // The four no issue names are listed, with what they are about.
          for (const path of [
            '/sig/api/profile',
            '/sig/api/subscribe',
            '/sig/asset/logo.png',
            '/sig/asset/theme.css',
          ]) {
            expect(automatic, path).toContain(path);
          }
          for (const status of ['404', '422']) {
            expect(automatic).toContain(status);
          }
          // The fifth is under its issue, and only there.
          expect(automatic).not.toContain('/sig/api/orders');
          expect(markdown.split('/sig/api/orders').length - 1).toBe(1);
          const issueAt = markdown.indexOf(
            'The list of orders cannot be loaded',
          );
          const ordersAt = markdown.indexOf('/sig/api/orders');
          const automaticAt = markdown.indexOf(REPORT_SIGNALS_HEADING);
          expect(issueAt).toBeGreaterThan(-1);
          expect(ordersAt).toBeGreaterThan(issueAt);
          expect(ordersAt).toBeLessThan(automaticAt);

          expect(sidecar.issues).toHaveLength(1);
          expect(sidecar.issues[0].signals?.map((s) => s.id)).toEqual([
            orders.id,
          ]);
          expect(sidecar.signals).toHaveLength(5);
          expect(sidecar.signal_counts).toEqual({
            total: 4,
            major: 0,
            minor: 4,
          });
        } finally {
          cleanUp();
        }
      },
    );

    gate(
      'S7.2',
      'R-S21',
      'a report without signals has no such section',
      async () => {
        try {
          const { markdown, sidecar } = await report([
            {
              area: '/sig-http',
              persona: 'gate',
              overall_impression: 'done',
              issues: [],
              signals: [],
            },
          ]);
          expect(markdown).not.toContain(REPORT_SIGNALS_HEADING);
          expect(sidecar.signals).toEqual([]);
        } finally {
          cleanUp();
        }
      },
    );
  });

  describe('S7.3 the verdict', () => {
    // Clicks "Load orders" and reports nothing, whatever it is shown.
    const seen: string[] = [];
    const decide = (async (_system: string, state: string) => {
      seen.push(state);
      const line = state
        .split('\n')
        .find((l) => l.includes('"Load orders"') && /\[e\d+\]/.test(l));
      const actions: Action[] = line
        ? [{ type: 'click', ref: [...line.matchAll(REF_IN_TEXT)][0][1] }]
        : [{ type: 'read' }];
      return { actions, issues: [] };
    }) as unknown as ActionDecider;

    const run = async (variant: 'buggy' | 'clean') => {
      seen.length = 0;
      const manager = new SessionManager();
      const before = ctx.gauntlet.requests.base.length;
      const result = await runHeadlessTest(decide, manager, {
        targetUrl: ctx.gauntlet.url('sig-http', `variant=${variant}`),
        personas: [PERSONA],
        steps: 2,
        headless: true,
      });
      expect(result.failures).toEqual([]);
      expect(manager.all()).toEqual([]);
      // The click happened: the decider found the button it was shown.
      expect(ctx.gauntlet.requests.base.slice(before)).toContain(
        'GET /sig/api/orders',
      );
      written.push(
        result.report.report_path,
        result.report.report_path.replace(/\.md$/, '.json'),
      );
      return result as typeof result & HeadlessVerdict;
    };

    gate(
      'S7.3',
      'R-S22',
      'haunt-ci exits 1 on sig-http buggy with a decider that reports no issue',
      async () => {
        try {
          const result = await run('buggy');
          expect(result.report.counts.total).toBe(0);
          expect(result.exitCode).toBe(1);
          expect(result.report.markdown).toContain(REPORT_SIGNALS_HEADING);
        } finally {
          cleanUp();
        }
      },
      60_000,
    );

    gate(
      'S7.3',
      'R-S22',
      'and exits 0 on its clean variant',
      async () => {
        try {
          const result = await run('clean');
          expect(result.report.counts.total).toBe(0);
          expect(result.exitCode).toBe(0);
          expect(result.report.markdown).not.toContain(REPORT_SIGNALS_HEADING);
        } finally {
          cleanUp();
        }
      },
      60_000,
    );

    gate(
      'S7.3',
      'R-S22 R-S23',
      'the decider is told what its last action caused',
      async () => {
        try {
          await run('buggy');
          // What it is shown after the click names the failure.
          expect(seen.length).toBeGreaterThanOrEqual(2);
          expect(seen[0]).not.toContain('/sig/api/orders');
          expect(seen[1]).toContain('/sig/api/orders');
          expect(seen[1]).toContain('500');
        } finally {
          cleanUp();
        }
      },
      60_000,
    );
  });

  describe('S7.4 the command', () => {
    gate(
      'S7.4',
      'R-S23',
      'the command prompt explains signals and names no tool the server lacks',
      async () => {
        const prompt = readFileSync(
          resolve(REPO_ROOT, 'commands/haunt-test.md'),
          'utf-8',
        );
        expect(prompt).toMatch(/\bsignals\b/);
        // It says an issue can name the signal it is about.
        expect(prompt).toMatch(/[`"]signal[`"]/);

        const { tools } = await ctx.haunt.client.listTools();
        const known = new Set(tools.map((t) => t.name));
        const named = new Set(prompt.match(/\bhaunt_[a-z_]+\b/g));
        expect(named.size).toBeGreaterThan(3);
        expect([...named].filter((name) => !known.has(name))).toEqual([]);

        // And the tools say it too, to a host that reads only their schema.
        const describes = (name: string, word: string) =>
          JSON.stringify(tools.find((t) => t.name === name)).includes(word);
        expect(describes('haunt_spawn', 'signal_thresholds')).toBe(true);
        expect(describes('haunt_capture_state', 'audit')).toBe(true);
        expect(describes('haunt_generate_report', 'signals')).toBe(true);
      },
    );
  });
});
