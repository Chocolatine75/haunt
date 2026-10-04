// E4 — secrets (R-E7, R-E15).
import { readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { describe, expect } from 'vitest';
import {
  EV_LOGIN,
  evIssued,
} from '../../test-support/gauntlet/evidence-routes.js';
import type { StepsFile, VerifiedIssue } from './contract.js';
import {
  type EvidenceSession,
  filesUnder,
  gate,
  readJson,
  useEvidence,
  zipEntries,
} from './harness.js';

const COOKIE = { name: 'pref', value: 'Cookie-Value-7f3k' };

// Every way a secret can be spelled once a page or a URL has it.
const formsOf = (secret: string) => [
  ...new Set([
    secret,
    encodeURIComponent(secret),
    secret.replaceAll(' ', '+'),
    encodeURIComponent(secret).replaceAll('%20', '+'),
  ]),
];
const SECRETS = [EV_LOGIN.email, EV_LOGIN.password, COOKIE.value];

// What a test wrote since it started. Other gate files run at the same time
// and write bundles of their own — E7.1's sabotage leaves the password in
// ev-login's trace on purpose — so the bundles searched, and deleted, are
// those of this test's sessions, and the reports its own.
function writtenBy(
  startedAt: number,
  sessions: string[],
  reports: string[],
): string[] {
  const root = resolve('.haunt-reports');
  const evidence = join(root, 'evidence');
  const ours = sessions.map((id) => join(evidence, id) + sep);
  const ourReports = reports.flatMap((path) => [
    resolve(path),
    resolve(path.replace(/\.md$/, '.json')),
  ]);
  return filesUnder(root).filter((file) => {
    if (statSync(file).mtimeMs < startedAt) return false;
    if (file.startsWith(evidence + sep)) {
      return ours.some((dir) => file.startsWith(dir));
    }
    if (dirname(file) === root) return ourReports.includes(file);
    return true;
  });
}
const FORMS = SECRETS.flatMap(formsOf);

const bundleOf = (issue: VerifiedIssue) => {
  if (!issue.verification.bundle) throw new Error('no bundle');
  return issue.verification.bundle;
};

describe('E4 secrets', () => {
  const ctx = useEvidence();

  async function signedIn(): Promise<EvidenceSession> {
    const session = await ctx.ev('ev-login', 'buggy', {
      cookies: [{ ...COOKIE, url: ctx.gauntlet.baseUrl }],
    });
    await session.play();
    const ended = await session.end();
    expect(ended.issues_found.map((i) => i.verification.status)).toEqual([
      'confirmed',
    ]);
    return session;
  }

  describe('E4.1 nowhere', () => {
    gate(
      'E4.1',
      'R-E7 R-E15',
      'no spelling of the email, the password or a cookie value is in any file of the bundle, the report or anything written',
      async () => {
        const startedAt = Date.now();
        ctx.transcript.length = 0;
        const session = await signedIn();
        const [issue] = session.ended?.issues_found ?? [];
        const report = await ctx.haunt.call<{ report_path: string }>(
          'haunt_generate_report',
          {
            target_url: ctx.gauntlet.baseUrl,
            personas: ['gate-e4-1'],
            sessions: [
              {
                area: '/ev-login',
                persona: 'gate',
                overall_impression: 'done',
                issues: session.ended?.issues_found ?? [],
                rejected: session.ended?.rejected ?? [],
                signals: session.ended?.signals ?? [],
                signal_verification: session.ended?.signal_verification ?? {},
              },
            ],
          },
        );
        expect(report.isError).toBe(false);

        const searched: string[] = [];
        const search = (where: string, content: string) => {
          searched.push(where);
          for (const form of FORMS) {
            expect(content.includes(form), `"${form}" in ${where}`).toBe(false);
          }
        };
        search('the tool results', ctx.transcript.join('\n'));
        const written = writtenBy(
          startedAt,
          [session.s.s.id],
          [report.data.report_path],
        );
        for (const file of written) {
          if (file.endsWith('.zip')) {
            for (const [name, data] of zipEntries(file)) {
              search(`${file}!${name}`, data.toString('latin1'));
            }
          } else {
            search(file, readFileSync(file).toString('latin1'));
          }
        }
        // The bundle was among them, and its trace was opened.
        expect(
          searched.some((w) => w.startsWith(resolve(bundleOf(issue)))),
        ).toBe(true);
        expect(searched.some((w) => w.includes('trace.zip!'))).toBe(true);
        expect(written).toContain(resolve(report.data.report_path));
        for (const file of written) rmSync(file, { force: true });
      },
    );
  });

  describe('E4.2 screenshots', () => {
    gate(
      'E4.2',
      'R-E15',
      'a screenshot of the filled email and password fields is the same as of the empty ones',
      async () => {
        const session = await ctx.ev('ev-login');
        const shoot = () => session.screenshot('sign-in');
        const empty = await shoot();
        await session.play(session.truth.steps.slice(0, 2));
        const filled = await shoot();
        expect(filled.equals(empty)).toBe(true);
      },
    );
  });

  describe('E4.3 replayed with its secrets', () => {
    gate(
      'E4.3',
      'R-E7 R-E14',
      'the bundle replays with the secrets passed to it, and not without them',
      async () => {
        const session = await signedIn();
        const bundle = bundleOf(
          session.ended?.issues_found[0] as VerifiedIssue,
        );
        const steps = readJson<StepsFile>(join(bundle, 'steps.json'));
        // Typed in the order of the steps: the email, then the password.
        expect(steps.secrets).toHaveLength(2);
        const secrets = {
          [steps.secrets[0]]: EV_LOGIN.email,
          [steps.secrets[1]]: EV_LOGIN.password,
        };
        expect((await ctx.replay({ bundle, secrets })).outcome).toBe(
          'reproduced',
        );
        const without = await ctx.replay({ bundle });
        expect(without.outcome).toBe('not_replayable');
        expect(without.failed_step).toBe(steps.steps[3].step);
      },
    );
  });

  describe('E4.4 a session opened signed in', () => {
    gate(
      'E4.4',
      'R-E7 R-E15',
      'opened with the cookies of a login, the account passed as secrets: no spelling of the account, of a cookie the server set or of a bearer token is in anything written',
      async () => {
        const startedAt = Date.now();
        const before = new Set(evIssued());
        ctx.transcript.length = 0;
        // As /haunt-test signs in: a first session logs in, and its cookies
        // open the session that tests. That one never types the account,
        // and the server keeps handing it new session cookies.
        const login = await ctx.ev('ev-login');
        await login.play(login.truth.steps.slice(0, 3));
        const got = await ctx.haunt.call<{ cookies: unknown[] }>(
          'haunt_get_cookies',
          { session_id: login.s.s.id },
        );
        if (got.isError) throw new Error(got.text);
        // The host asked for the cookies and has them: what comes back after
        // that is what must be clean.
        const afterCookies = ctx.transcript.length;
        const session = await ctx.ev('ev-login', 'buggy', {
          cookies: got.data.cookies,
          secrets: [EV_LOGIN.email, EV_LOGIN.password],
        });
        await session.play(session.truth.steps.slice(3));
        const ended = await session.end();
        expect(ended.issues_found.map((i) => i.verification.status)).toEqual([
          'confirmed',
        ]);
        const report = await ctx.haunt.call<{ report_path: string }>(
          'haunt_generate_report',
          {
            target_url: ctx.gauntlet.baseUrl,
            personas: ['gate-e4-4'],
            sessions: [
              {
                area: '/ev-login',
                persona: 'gate',
                overall_impression: 'done',
                issues: ended.issues_found,
                rejected: ended.rejected,
                signals: ended.signals,
                signal_verification: ended.signal_verification,
              },
            ],
          },
        );
        expect(report.isError).toBe(false);

        // The tokens of this test: the login's, and those its replays got.
        const tokens = evIssued().filter((t) => !before.has(t));
        expect(tokens.length).toBeGreaterThan(3);
        const forms = [
          ...formsOf(EV_LOGIN.email),
          ...formsOf(EV_LOGIN.password),
          ...tokens,
        ];
        const searched: string[] = [];
        const search = (where: string, content: string) => {
          searched.push(where);
          for (const form of forms) {
            expect(content.includes(form), `"${form}" in ${where}`).toBe(false);
          }
        };
        search(
          'the tool results',
          ctx.transcript.slice(afterCookies).join('\n'),
        );
        const written = writtenBy(
          startedAt,
          [login.s.s.id, session.s.s.id],
          [report.data.report_path],
        );
        for (const file of written) {
          if (file.endsWith('.zip')) {
            for (const [name, data] of zipEntries(file)) {
              search(`${file}!${name}`, data.toString('latin1'));
            }
          } else {
            search(file, readFileSync(file).toString('latin1'));
          }
        }
        const [issue] = ended.issues_found;
        expect(
          searched.some((w) => w.startsWith(resolve(bundleOf(issue)))),
        ).toBe(true);
        expect(searched.some((w) => w.includes('trace.zip!'))).toBe(true);
        for (const file of written) rmSync(file, { force: true });
      },
    );
  });
});
