// E6 — where it goes (R-E17, R-E18).
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect } from 'vitest';
import { runHeadlessTest } from '../../cli/headless.js';
import type { ActionDecider } from '../../cli/providers/types.js';
import { SessionManager } from '../../engine/session/manager.js';
import { type Action, REF_IN_TEXT } from '../part-1/contract.js';
import { PERSONA } from '../part-2/harness.js';
import {
  type ClaimedIssue,
  REPORT_FLAKY_HEADING,
  REPORT_UNVERIFIED_HEADING,
  type ReportEvidenceSidecar,
} from './contract.js';
import { type EvidenceSession, gate, useEvidence } from './harness.js';

const REPO_ROOT = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../..',
);

describe('E6 where it goes', () => {
  const ctx = useEvidence();
  const written: string[] = [];
  const cleanUp = () => {
    for (const path of written.splice(0)) rmSync(path, { force: true });
  };

  const sessionInput = (area: string, session: EvidenceSession) => ({
    area,
    persona: 'gate',
    overall_impression: 'done',
    issues: session.ended?.issues_found ?? [],
    rejected: session.ended?.rejected ?? [],
    signals: session.ended?.signals ?? [],
    signal_verification: session.ended?.signal_verification ?? {},
  });

  describe('E6.1 the session result', () => {
    gate(
      'E6.1',
      'R-E17',
      'haunt_end_session returns each issue’s status, rate and bundle, and the rejected ones with their reason',
      async () => {
        const session = await ctx.ev('ev-flaky');
        await session.play();
        const [issue] = session.issues();
        const ended = await session.end([
          issue,
          // A signal the session does not have. It was an issue with no
          // claim until part 4, which no longer rejects those (R-T11).
          { ...issue, signal: 's999', description: 'No such signal' },
        ]);
        expect(ended.issues_found).toHaveLength(1);
        expect(ended.issues_found[0].verification).toMatchObject({
          status: 'flaky',
          rate: 0.2,
        });
        expect(ended.issues_found[0].verification.bundle).toBeTruthy();
        expect(ended.rejected).toHaveLength(1);
        expect(ended.rejected[0].verification.reason).toBe('unknown_signal');
      },
    );
  });

  describe('E6.2 the report', () => {
    gate(
      'E6.2',
      'R-E12 R-E17',
      'confirmed issues, a flaky section with rates, an unverified one, each linked to its bundle',
      async () => {
        try {
          const confirmed = await ctx.ev('ev-sequence');
          await confirmed.play();
          await confirmed.end();
          const flaky = await ctx.ev('ev-flaky');
          await flaky.play();
          await flaky.end();
          const unverified = await ctx.ev('ev-late', 'buggy', {
            replay_budget_ms: 1_000,
          });
          await unverified.play();
          await unverified.end();

          const result = await ctx.haunt.call<{
            report_path: string;
            markdown: string;
          }>('haunt_generate_report', {
            target_url: ctx.gauntlet.baseUrl,
            personas: ['gate-e6-2'],
            sessions: [
              sessionInput('/ev-sequence', confirmed),
              sessionInput('/ev-flaky', flaky),
              sessionInput('/ev-late', unverified),
            ],
          });
          if (result.isError) throw new Error(result.text);
          const { markdown, report_path } = result.data;
          const sidecarPath = report_path.replace(/\.md$/, '.json');
          written.push(report_path, sidecarPath);
          const sidecar: ReportEvidenceSidecar = JSON.parse(
            readFileSync(sidecarPath, 'utf-8'),
          );

          expect(sidecar.issues).toHaveLength(1);
          expect(sidecar.flaky).toHaveLength(1);
          expect(sidecar.unverified).toHaveLength(1);
          expect(markdown).toContain(`## ${REPORT_FLAKY_HEADING}`);
          expect(markdown).toContain(`## ${REPORT_UNVERIFIED_HEADING}`);
          expect(markdown).toMatch(/2 of 10|20 ?%/);
          for (const issue of [...sidecar.issues, ...sidecar.flaky]) {
            expect(markdown).toContain(issue.verification.bundle as string);
          }
        } finally {
          cleanUp();
        }
      },
    );
  });

  describe('E6.3 the verdict', () => {
    // On ev-sequence: places the order, then files one issue — naming the
    // signal it was shown if `honest`, a made-up observation otherwise.
    const decider = (honest: boolean) => {
      let turn = 0;
      return (async (_system: string, state: string) => {
        turn++;
        const ref = (name: string) => {
          const line = state.split('\n').find((l) => l.includes(name));
          return line ? [...line.matchAll(REF_IN_TEXT)][0]?.[1] : undefined;
        };
        if (turn === 1) {
          const actions: Action[] = [
            { type: 'fill', ref: ref('"Name"') ?? 'e0', text: 'Ada Lovelace' },
            {
              type: 'select',
              ref: ref('"Shipping"') ?? 'e0',
              values: ['Express'],
            },
            { type: 'click', ref: ref('"Place order"') ?? 'e0' },
          ];
          return { actions, issues: [] };
        }
        const signal = /- (s\d+) \[major\]/.exec(state)?.[1];
        const issue: ClaimedIssue = {
          severity: 'major',
          category: 'ux',
          description: 'The order fails',
          page_url: ctx.gauntlet.url('ev-sequence'),
          recommendation: 'Fix the order endpoint',
          ...(honest && signal
            ? { signal }
            : { observed: { text_present: 'Database melted' } }),
        };
        return { actions: [], issues: [issue] };
      }) as unknown as ActionDecider;
    };

    const run = async (variant: 'buggy' | 'clean', honest: boolean) => {
      const result = await runHeadlessTest(
        decider(honest),
        new SessionManager(),
        {
          targetUrl: ctx.gauntlet.url('ev-sequence', `variant=${variant}`),
          personas: [PERSONA],
          steps: 2,
          headless: true,
        },
      );
      written.push(
        result.report.report_path,
        result.report.report_path.replace(/\.md$/, '.json'),
      );
      return result as typeof result & { exitCode: 0 | 1 };
    };

    gate(
      'E6.3',
      'R-E12',
      'haunt-ci exits 0 on the clean page when the decider files only false issues',
      async () => {
        try {
          const result = await run('clean', false);
          expect(result.report.counts.total).toBe(0);
          expect(result.exitCode).toBe(0);
        } finally {
          cleanUp();
        }
      },
      180_000,
    );

    gate(
      'E6.3',
      'R-E12',
      'and exits 1 on the buggy page with one true issue',
      async () => {
        try {
          const result = await run('buggy', true);
          expect(result.report.counts.total).toBe(1);
          expect(result.exitCode).toBe(1);
          // Because the issue was confirmed, not merely filed.
          const sidecar: ReportEvidenceSidecar = JSON.parse(
            readFileSync(
              result.report.report_path.replace(/\.md$/, '.json'),
              'utf-8',
            ),
          );
          expect(sidecar.issues[0]?.verification?.status).toBe('confirmed');
        } finally {
          cleanUp();
        }
      },
      180_000,
    );
  });

  describe('E6.4 the command', () => {
    gate(
      'E6.4',
      'R-E18',
      'the command prompt explains claims and names no tool the server lacks',
      async () => {
        const prompt = readFileSync(
          resolve(REPO_ROOT, 'commands/haunt-test.md'),
          'utf-8',
        );
        expect(prompt).toMatch(/[`"]observed[`"]/);
        expect(prompt).toMatch(/\brejected\b/);
        expect(prompt).toMatch(/\bflaky\b/);
        const { tools } = await ctx.haunt.client.listTools();
        const known = new Set(tools.map((t) => t.name));
        expect(known.has('haunt_replay')).toBe(true);
        const named = new Set(prompt.match(/\bhaunt_[a-z_]+\b/g));
        expect([...named].filter((name) => !known.has(name))).toEqual([]);
        const describes = (name: string, word: string) =>
          JSON.stringify(tools.find((t) => t.name === name)).includes(word);
        expect(describes('haunt_act', 'observed')).toBe(true);
        expect(describes('haunt_end_session', 'observed')).toBe(true);
        expect(describes('haunt_spawn', 'replay_budget_ms')).toBe(true);
      },
    );
  });
});
