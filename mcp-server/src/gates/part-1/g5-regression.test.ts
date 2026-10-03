// G5 — nothing regressed (R-E1 … R-E4).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { authenticate } from '../../cli/authenticate.js';
import { runHeadlessTest } from '../../cli/headless.js';
import type { ActionDecider } from '../../cli/providers/types.js';
import { SessionManager } from '../../engine/session/manager.js';
import { type Action, REF_IN_TEXT } from './contract.js';
import { gate, useGauntlet } from './harness.js';
import { PASSING } from './status.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SERVER_DIR = resolve(HERE, '../../..');
const REPO_ROOT = resolve(SERVER_DIR, '..');
const PERSONA = resolve(
  HERE,
  '../../engine/persona/__fixtures__/valid-persona.yaml',
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('G5 nothing regressed', () => {
  const ctx = useGauntlet();

  describe('G5.1 the sandbox holds for every action, frame and tab', () => {
    const ESCAPES: Array<
      [g: string, method: string, path: string, secret: string]
    > = [
      ['link', 'GET', '/tabs/child', 'secret-in-link'],
      ['form-post', 'POST', '/api/login', 'secret-in-form'],
      ['fetch', 'GET', '/api/poll', 'secret-in-fetch'],
      ['beacon', 'POST', '/api/poll', 'secret-in-beacon'],
      ['image', 'GET', '/api/poll', 'secret-in-image'],
      ['redirect', 'GET', '/redirect', 'secret-in-redirect'],
      ['window-open', 'GET', '/tabs/child', 'secret-in-window'],
      ['link-new-tab', 'GET', '/tabs/child', 'secret-in-tab'],
    ];

    for (const [id, method, path, secret] of ESCAPES) {
      gate(
        'G5.1',
        'R-E1',
        `${id}: blocked, recorded without its query string, never received`,
        async () => {
          const s = await ctx.open('escape');
          const before = ctx.gauntlet.requests.other.length;

          const result = await s.act({ type: 'click', ref: await s.ref(id) });
          await s.page.waitForTimeout(400);
          const ended = await s.end();

          expect(ctx.gauntlet.requests.other.slice(before)).toEqual([]);
          const blocked = [
            ...(result.sandbox_blocked ?? []),
            ...ended.sandbox_blocked_requests,
          ];
          const expected =
            id === 'redirect'
              ? `GET ${ctx.gauntlet.baseUrl}/redirect -> ${ctx.gauntlet.otherUrl}/tabs/child (cross-origin redirect)`
              : `${method} ${ctx.gauntlet.otherUrl}${path}`;
          expect(blocked).toContain(expected);
          expect(JSON.stringify(blocked)).not.toContain(secret);
          expect(ended.issues_found).toEqual([]);
        },
      );
    }

    gate(
      'G5.1',
      'R-E1',
      'a fetch and a link inside an iframe are blocked too',
      async () => {
        const s = await ctx.open('escape');
        const before = ctx.gauntlet.requests.other.length;
        await s.act({ type: 'click', ref: await s.ref('frame-fetch') });
        await s.act({ type: 'click', ref: await s.ref('frame-link') });
        await s.page.waitForTimeout(400);

        expect(ctx.gauntlet.requests.other.slice(before)).toEqual([]);
        const { sandbox_blocked_requests } = await s.end();
        expect(sandbox_blocked_requests).toEqual(
          expect.arrayContaining([
            `GET ${ctx.gauntlet.otherUrl}/api/poll`,
            `GET ${ctx.gauntlet.otherUrl}/tabs/child`,
          ]),
        );
      },
    );

    gate(
      'G5.1',
      'R-E1',
      'a tab the page opened is sandboxed like the first one',
      async () => {
        const s = await ctx.open('escape');
        const before = ctx.gauntlet.requests.other.length;
        await s.act({ type: 'click', ref: await s.ref('same-origin-tab') });
        await s.ok({ type: 'tab', op: 'switch', index: 1 });

        const error = await s.fail({
          type: 'goto',
          url: `${ctx.gauntlet.otherUrl}/tabs/child?token=secret-from-new-tab`,
        });
        expect(error.code).toBe('sandbox_blocked');
        expect(ctx.gauntlet.requests.other.slice(before)).toEqual([]);
      },
    );

    gate(
      'G5.1',
      'R-E1',
      'a tab opened by the tab action is sandboxed too',
      async () => {
        const s = await ctx.open('escape');
        const before = ctx.gauntlet.requests.other.length;
        const result = await s.act({
          type: 'tab',
          op: 'new',
          url: `${ctx.gauntlet.otherUrl}/tabs/child`,
        });
        expect(result.results[0].error?.code).toBe('sandbox_blocked');
        expect(ctx.gauntlet.requests.other.slice(before)).toEqual([]);
      },
    );

    gate(
      'G5.1b',
      'R-E1',
      'an origin the page loads itself stays allowed',
      async () => {
        const s = await ctx.open('frames');
        await s.page.waitForTimeout(1_300);
        const frame = await s.frame('cross');
        expect(new URL(frame.url()).origin).toBe(ctx.gauntlet.otherUrl);
        expect((await s.end()).sandbox_blocked_requests).toEqual([]);
      },
    );
  });

  describe('G5.2 secrets never leave the page', () => {
    gate(
      'G5.2',
      'R-E2',
      'values typed into credential fields appear in nothing the server returns or writes',
      async () => {
        const secrets = {
          'secret-answer': 'first-pet-Rex-7731',
          pin: 'pin-4471-zzq',
          password: 'pw-correct-horse-88',
          email: 'private.person@example.com',
        };
        const startedAt = Date.now();
        const s = await ctx.open('forms');
        ctx.transcript.length = 0;

        for (const [id, text] of Object.entries(secrets)) {
          await s.ok({ type: 'fill', ref: await s.ref(id), text });
          // Typed for real: the page has it.
          expect(await s.dom(id, 'el.value')).toBe(text);
        }
        // Key-by-key typing, snapshots in both formats, a diff, a read, and a
        // few failures for good measure.
        await s.ok({ type: 'fill', ref: await s.ref('pin'), text: '' });
        await s.ok({
          type: 'type',
          ref: await s.ref('pin'),
          text: secrets.pin,
        });
        await s.snapshot();
        await s.capture({ format: 'text' });
        await s.capture({ format: 'json', diff: true });
        await s.act({ type: 'read' });
        await s.act({ type: 'click', ref: 'e999999' });
        await s.act({
          type: 'fill',
          ref: await s.ref('disabled-input'),
          text: secrets.password,
        });
        await s.act({ type: 'click', ref: await s.ref('submit') });
        const ended = await s.end();
        await ctx.haunt.call('haunt_generate_report', {
          target_url: ctx.gauntlet.baseUrl,
          personas: ['gate-g5-2'],
          sessions: [
            {
              area: '/forms',
              persona: 'gate',
              overall_impression: 'done',
              issues: ended.issues_found,
            },
          ],
        });

        const everything = ctx.transcript.join('\n');
        expect(everything.length).toBeGreaterThan(1_000);
        for (const [id, secret] of Object.entries(secrets)) {
          expect(
            everything.includes(secret),
            `${id} leaked into a tool result`,
          ).toBe(false);
        }

        // And nothing written to disk during the test contains them either.
        const reports = resolve('.haunt-reports');
        if (existsSync(reports)) {
          for (const entry of readdirSync(reports)) {
            const path = join(reports, entry);
            if (!statSync(path).isFile() || statSync(path).mtimeMs < startedAt)
              continue;
            const content = readFileSync(path, 'utf-8');
            for (const secret of Object.values(secrets)) {
              expect(
                content.includes(secret),
                `${entry} contains a secret`,
              ).toBe(false);
            }
          }
        }
      },
      60_000,
    );

    gate(
      'G5.2',
      'R-E2',
      'a credential field is detected by its type and autocomplete, not only its label',
      async () => {
        const s = await ctx.open('forms');
        await s.ok(
          { type: 'fill', ref: await s.ref('secret-answer'), text: 'Rex' },
          { type: 'fill', ref: await s.ref('pin'), text: '4471' },
          { type: 'fill', ref: await s.ref('text'), text: 'Ada' },
        );
        expect((await s.element('secret-answer')).value).toBe('(filled)');
        expect((await s.element('pin')).value).toBe('(filled)');
        // An ordinary field is not hidden: a tester needs to see it.
        expect((await s.element('text')).value).toBe('Ada');
      },
    );
  });

  describe('G5.3 haunt-ci works with references', () => {
    gate(
      'G5.3',
      'R-E3',
      'a scripted decider drives a session using references read from the state description',
      async () => {
        const seen: string[] = [];
        // A table cell on a line of its own — the status message also names
        // the invoice it deleted.
        const row = (invoice: string) => new RegExp(`^\\s*${invoice}$`, 'm');
        // Clicks the first "Delete" button it is shown, three times.
        const decide = (async (_system: string, state: string) => {
          seen.push(state);
          const line = state
            .split('\n')
            .find((l) => l.includes('"Delete"') && /\[e\d+\]/.test(l));
          const ref = line ? [...line.matchAll(REF_IN_TEXT)][0][1] : 'e0';
          const actions: Action[] = [{ type: 'click', ref }];
          return { actions, issues: [] };
        }) as unknown as ActionDecider;

        const manager = new SessionManager();
        const { report, failures } = await runHeadlessTest(decide, manager, {
          targetUrl: ctx.gauntlet.url('dupes'),
          personas: [PERSONA],
          steps: 3,
          headless: true,
        });

        expect(failures).toEqual([]);
        // Three steps; haunt-ci then asks once more what the last one showed.
        expect(seen.length).toBeGreaterThanOrEqual(3);
        expect(seen[0]).toMatch(row('INV-001'));
        expect(seen[1]).not.toMatch(row('INV-001'));
        expect(seen[2]).not.toMatch(row('INV-002'));
        expect(seen[2]).toMatch(row('INV-003'));
        // No failed action was turned into an issue on the way.
        expect(report.counts.total).toBe(0);
        expect(manager.all()).toEqual([]);
      },
      60_000,
    );
  });

  describe('G5.4 login', () => {
    gate(
      'G5.4',
      'R-E3',
      'authenticate signs in past a decoy "Log in" link and returns the session cookie',
      async () => {
        const manager = new SessionManager();
        const cookies = await authenticate(manager, {
          loginUrl: ctx.gauntlet.url('login'),
          email: 'ghost@example.com',
          password: 'boo-1234',
          headless: true,
          persona: PERSONA,
        });
        expect(cookies).toContainEqual(
          expect.objectContaining({
            name: 'gauntlet_session',
            value: 'signed-in',
            httpOnly: true,
          }),
        );
        expect(manager.all()).toEqual([]);
      },
      90_000,
    );

    gate(
      'G5.4b',
      'R-E3',
      'authenticate fails clearly on wrong credentials, within 30 s, without leaking them',
      async () => {
        const manager = new SessionManager();
        const attempt = authenticate(manager, {
          loginUrl: ctx.gauntlet.url('login'),
          email: 'ghost@example.com',
          password: 'wrong-password-991',
          headless: true,
          persona: PERSONA,
        });
        await expect(attempt).rejects.toThrow(/login failed/);
        await expect(attempt).rejects.not.toThrow(/wrong-password-991/);
        expect(manager.all()).toEqual([]);
      },
      30_000,
    );
  });

  describe('G5.5 the old grammar is gone', () => {
    gate(
      'G5.5',
      'R-E3',
      'nothing in the repo refers to haunt_navigate or the sentence grammar',
      async () => {
        const files = [
          join(REPO_ROOT, 'commands', 'haunt-test.md'),
          join(REPO_ROOT, 'README.md'),
          join(REPO_ROOT, 'docs', 'cli.md'),
          ...sourceFiles(join(SERVER_DIR, 'src')).filter(
            (f) => !f.includes(`${join('src', 'gates')}`),
          ),
        ];
        const offenders = files.filter((f) =>
          readFileSync(f, 'utf-8').includes('haunt_navigate'),
        );
        expect(offenders).toEqual([]);

        const command = readFileSync(
          join(REPO_ROOT, 'commands', 'haunt-test.md'),
          'utf-8',
        );
        expect(command).toContain('haunt_act');
        expect(command).not.toMatch(/fill <text> in <field>/);
      },
    );

    gate(
      'G5.5',
      'R-E3',
      'the server no longer offers haunt_navigate',
      async () => {
        const { tools } = await ctx.haunt.client.listTools();
        const names = tools.map((t) => t.name);
        expect(names).toContain('haunt_act');
        expect(names).not.toContain('haunt_navigate');
      },
    );
  });

  describe('G5.6 the earlier tests are still there', () => {
    // Deleting a test is the cheapest way to make a suite pass.
    const KEPT = [
      'distribution.test.ts',
      'mcp/server.test.ts',
      'e2e/mcp-flow.test.ts',
      'e2e/headless-flow.test.ts',
      'engine/spawn.test.ts',
      'engine/spawn-session.test.ts',
      'engine/capture.test.ts',
      'engine/end-session.test.ts',
      'engine/get-cookies.test.ts',
      'engine/session/manager.test.ts',
      'engine/persona/loader.test.ts',
      'engine/persona/builtin-personas.test.ts',
      'engine/report/generate-report.test.ts',
      'engine/report/estimate-cost.test.ts',
      'cli/headless.test.ts',
      'cli/authenticate.test.ts',
      'benchmark/run.test.ts',
      'test-support/gauntlet/gauntlet.test.ts',
    ];

    gate(
      'G5.6',
      'R-E4',
      'no earlier test file has been removed or emptied',
      async () => {
        for (const file of KEPT) {
          const path = join(SERVER_DIR, 'src', file);
          expect(existsSync(path), file).toBe(true);
          const tests =
            readFileSync(path, 'utf-8').match(
              /\b(it|gate)(\.each\([^)]*\))?\(/g,
            ) ?? [];
          expect(tests.length, file).toBeGreaterThan(2);
        }
      },
    );
  });

  // Not a gate test: keeps the bookkeeping honest for this file.
  it('lists G5.6 as passing from the start', () => {
    expect(PASSING.has('G5.6')).toBe(true);
  });
});
