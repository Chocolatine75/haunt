// E4 — secrets (R-E7, R-E15).
import { readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect } from 'vitest';
import { EV_LOGIN } from '../../test-support/gauntlet/evidence-routes.js';
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
        const written = filesUnder(resolve('.haunt-reports')).filter(
          (file) => statSync(file).mtimeMs >= startedAt,
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
});
