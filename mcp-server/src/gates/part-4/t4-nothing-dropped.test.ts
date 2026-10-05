// T4 — nothing seen is dropped in silence (R-T11, R-T12).
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { runHeadlessTest } from '../../cli/headless.js';
import type { ActionDecider } from '../../cli/providers/types.js';
import { SessionManager } from '../../engine/session/manager.js';
import { type Action, REF_IN_TEXT } from '../part-1/contract.js';
import type { StepsFile } from '../part-3/contract.js';
import {
  type EndSessionTesterOutput,
  REPORT_COVERAGE_HEADING,
  REPORT_UNCHECKED_HEADING,
  type ReportTesterSidecar,
} from './contract.js';
import { type TesterSession, gate, useTester } from './harness.js';

// The lines of a markdown report under the heading `title`, up to the next
// heading of the same level.
function section(markdown: string, title: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l === `## ${title}`);
  if (start === -1) throw new Error(`no "${title}" section in the report`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

describe('T4 nothing dropped', () => {
  const ctx = useTester();
  const written: string[] = [];
  const cleanUp = () => {
    for (const path of written.splice(0)) rmSync(path, { force: true });
  };

  async function report(session: TesterSession, ended: EndSessionTesterOutput) {
    const result = await ctx.haunt.call<{
      report_path: string;
      markdown: string;
      counts: { total: number };
    }>('haunt_generate_report', {
      target_url: session.url,
      personas: [],
      date: '2026-04-04',
      sessions: [
        {
          area: `/${session.page}`,
          overall_impression: 'done',
          issues: ended.issues_found,
          rejected: ended.rejected,
          signals: ended.signals,
          signal_verification: ended.signal_verification,
          cases: ended.cases,
          coverage: ended.coverage,
        },
      ],
    });
    if (result.isError) throw new Error(result.text);
    const sidecarPath = result.data.report_path.replace(/\.md$/, '.json');
    written.push(result.data.report_path, sidecarPath);
    return {
      ...result.data,
      sidecar: JSON.parse(
        readFileSync(sidecarPath, 'utf-8'),
      ) as ReportTesterSidecar,
    };
  }

  describe('T4.1 unchecked, not rejected', () => {
    gate(
      'T4.1',
      'R-T11',
      'an issue with no claim the engine can check ends unchecked, with the bundle of its steps',
      async () => {
        const session = await ctx.qa('qa-rating');
        await session.act([
          { type: 'click', ref: await session.ref('refresh') },
        ]);
        const ended = await session.end([
          session.issue({
            description: 'Every kettle shows five stars',
            expected: 'As many stars as the score beside them',
            actual: 'Five stars on a kettle scored 2.0',
          }),
        ]);
        expect(ended.rejected).toEqual([]);
        expect(ended.issues_found).toHaveLength(1);
        const { verification } = ended.issues_found[0];
        expect(verification.status).toBe('unchecked');
        // Its steps were replayed, to establish that they run.
        expect(verification.attempts).toBeGreaterThanOrEqual(1);
        const steps = join(verification.bundle as string, 'steps.json');
        expect(existsSync(steps)).toBe(true);
        expect(
          (JSON.parse(readFileSync(steps, 'utf-8')) as StepsFile).steps,
        ).toHaveLength(1);

        try {
          const { markdown, counts, sidecar } = await report(session, ended);
          const byHand = section(markdown, REPORT_UNCHECKED_HEADING);
          expect(byHand).toContain('Every kettle shows five stars');
          expect(byHand).toContain('As many stars as the score beside them');
          expect(byHand).toContain('Five stars on a kettle scored 2.0');
          expect(byHand).toContain(verification.bundle as string);
          // In no count, and not among the issues.
          expect(counts.total).toBe(0);
          expect(section(markdown, 'Issues')).not.toContain('five stars');
          expect(sidecar.issues).toEqual([]);
          expect(sidecar.unchecked.map((i) => i.description)).toEqual([
            'Every kettle shows five stars',
          ]);
        } finally {
          cleanUp();
        }
      },
      180_000,
    );

    gate(
      'T4.1',
      'R-T11',
      'haunt-ci exits 0 when an unchecked issue is all there is',
      async () => {
        // Clicks "Refresh ratings" and files a major issue with nothing the
        // engine can check.
        const decide = (async (_system: string, state: string) => {
          const line = state
            .split('\n')
            .find((l) => l.includes('"Refresh ratings"') && /\[e\d+\]/.test(l));
          const actions: Action[] = line
            ? [{ type: 'click', ref: [...line.matchAll(REF_IN_TEXT)][0][1] }]
            : [{ type: 'read' }];
          return {
            actions,
            issues: [
              {
                severity: 'major',
                category: 'ux',
                description: 'The stars look wrong',
                page_url: ctx.gauntlet.url('qa-rating'),
                recommendation: 'Check them',
              },
            ],
          };
        }) as unknown as ActionDecider;
        const manager = new SessionManager();
        try {
          const result = await runHeadlessTest(decide, manager, {
            targetUrl: ctx.gauntlet.url('qa-rating', 'variant=buggy'),
            personas: [],
            steps: 2,
            headless: true,
          });
          written.push(
            result.report.report_path,
            result.report.report_path.replace(/\.md$/, '.json'),
          );
          expect(result.failures).toEqual([]);
          expect(result.report.counts.total).toBe(0);
          expect(result.report.markdown).toContain(
            `## ${REPORT_UNCHECKED_HEADING}`,
          );
          expect(result.exitCode).toBe(0);
        } finally {
          cleanUp();
        }
      },
      180_000,
    );
  });

  describe('T4.2 what is still rejected', () => {
    gate(
      'T4.2',
      'R-T11',
      'an issue naming a signal the session does not have is rejected as before',
      async () => {
        const session = await ctx.qa('qa-rating');
        await session.act([
          { type: 'click', ref: await session.ref('refresh') },
        ]);
        const ended = await session.end([session.issue({ signal: 's999' })]);
        expect(ended.issues_found).toEqual([]);
        expect(ended.rejected.map((i) => i.verification)).toMatchObject([
          { status: 'rejected', reason: 'unknown_signal' },
        ]);
      },
    );
  });

  describe('T4.3 the report says what was tested', () => {
    gate(
      'T4.3',
      'R-T12',
      'its coverage section is the engine’s count, and names the controls never touched',
      async () => {
        const session = await ctx.qa('qa-sort');
        await session.register();
        await session.playAll();
        const ended = await session.end();
        expect(ended.coverage.controls).toEqual({ listed: 4, exercised: 1 });
        try {
          const { markdown, sidecar } = await report(session, ended);
          const coverage = section(markdown, REPORT_COVERAGE_HEADING);
          expect(coverage).toContain('1 of 4 controls');
          expect(coverage).toContain('0 passed, 1 failed, 0 not run');
          for (const name of [
            'Compact view',
            'Shipping details',
            'Compare selected',
          ]) {
            expect(coverage).toContain(`button "${name}"`);
          }
          expect(coverage).not.toContain('"Sort by"');
          // No reference: it means nothing outside the session.
          expect(coverage).not.toMatch(/\be\d+\b/);
          expect(sidecar.coverage).toEqual(ended.coverage);
        } finally {
          cleanUp();
        }
      },
    );

    gate(
      'T4.3',
      'R-T12',
      'several sessions add up, and a report of sessions without coverage has no such section',
      async () => {
        const reports = async (sessions: unknown[]) => {
          const result = await ctx.haunt.call<{
            report_path: string;
            markdown: string;
          }>('haunt_generate_report', {
            target_url: ctx.gauntlet.baseUrl,
            personas: [],
            date: '2026-04-05',
            sessions,
          });
          if (result.isError) throw new Error(result.text);
          written.push(
            result.data.report_path,
            result.data.report_path.replace(/\.md$/, '.json'),
          );
          return result.data.markdown;
        };
        const base = { overall_impression: 'done', issues: [] };
        const coverage = (listed: number, exercised: number, name: string) => ({
          controls: { listed, exercised },
          cases: { planned: 2, run: 1, passed: 1, failed: 0 },
          left: {
            controls: [{ ref: 'e1', role: 'button', name }],
            cases: ['later'],
          },
        });
        try {
          const two = await reports([
            { ...base, area: '/a', coverage: coverage(4, 3, 'Export') },
            { ...base, area: '/b', coverage: coverage(6, 5, 'Archive') },
          ]);
          const text = section(two, REPORT_COVERAGE_HEADING);
          expect(text).toContain('8 of 10 controls');
          expect(text).toContain('2 passed, 0 failed, 2 not run');
          expect(text).toContain('button "Export"');
          expect(text).toContain('button "Archive"');
          expect(await reports([{ ...base, area: '/a' }])).not.toContain(
            `## ${REPORT_COVERAGE_HEADING}`,
          );
        } finally {
          cleanUp();
        }
      },
    );
  });
});
