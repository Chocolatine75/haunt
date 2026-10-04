// One problem, one entry in the report, however many testers, pages or
// sessions reached it (the run on demo/ that listed one 500 twice and one
// contrast rule six times).
import { readFileSync, rmSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import type { Issue } from '../types.js';
import {
  type GenerateReportInput,
  type ReportSignal,
  hauntGenerateReport,
} from './generate-report.js';
import { signalKey } from './group.js';

const written: string[] = [];
afterAll(() => {
  for (const path of written) rmSync(path, { force: true });
});

function generate(sessions: GenerateReportInput['sessions']) {
  const result = hauntGenerateReport({
    target_url: 'http://localhost:3000',
    personas: ['group-test'],
    date: '2026-03-03',
    sessions,
  });
  const sidecarPath = result.report_path.replace(/\.md$/, '.json');
  written.push(result.report_path, sidecarPath);
  return {
    ...result,
    sidecar: JSON.parse(readFileSync(sidecarPath, 'utf-8')),
    automatic: result.markdown.split('## Detected automatically')[1] ?? '',
  };
}

function issue(overrides: Partial<Issue>): Issue {
  return {
    severity: 'major',
    category: 'ux',
    description: 'Something is off',
    page_url: 'http://localhost:3000/signup',
    recommendation: 'Fix it',
    ...overrides,
  };
}

const signup500 = (id: string, step: number): ReportSignal => ({
  id,
  kind: 'http_error',
  url: 'http://localhost:3000/signup',
  step,
  message: 'POST /api/signup answered 500',
  severity: 'major',
  count: 1,
  method: 'POST',
  request_url: 'http://localhost:3000/api/signup',
  status: 500,
});

const contrast = (id: string, page: string, nodes: number): ReportSignal => ({
  id,
  kind: 'a11y',
  url: `http://localhost:3000${page}`,
  step: 0,
  message: `Elements must meet minimum color contrast ratio thresholds (${nodes} elements)`,
  severity: 'major',
  count: 1,
  rule: 'color-contrast',
  help: 'Elements must meet minimum color contrast ratio thresholds',
});

describe('grouping the report by problem', () => {
  it('makes one entry of two issues about the same server error', () => {
    const result = generate([
      {
        area: '/signup',
        persona: 'Beginner',
        overall_impression: 'stuck',
        issues: [
          issue({
            severity: 'critical',
            description: 'Signing up fails with a server error',
            signal: 's1',
          }),
        ],
        signals: [signup500('s1', 2)],
      },
      {
        area: '/signup',
        persona: 'Power user',
        overall_impression: 'stuck',
        issues: [
          issue({
            description: 'Signing up twice in a row shows an error',
            signal: 's4',
          }),
        ],
        signals: [signup500('s4', 5)],
      },
    ]);

    expect(result.counts).toMatchObject({ total: 1, critical: 1, major: 0 });
    expect(result.markdown).toContain(
      '### 1. [CRITICAL] Signing up fails with a server error',
    );
    expect(result.markdown).not.toContain('### 2.');
    expect(result.markdown).toContain(
      '- **Also reported:** Signing up twice in a row shows an error',
    );
    // Both occurrences under the one entry, on one line.
    expect(result.markdown).toContain(
      '- **Detected:** [MAJOR] POST /api/signup answered 500 — `http://localhost:3000/signup` (steps 2, 5, 2 times)',
    );
    expect(result.markdown).not.toContain('## Detected automatically');
    // The sidecar keeps both, so that a later run can be compared with each.
    expect(result.sidecar.issues).toHaveLength(2);
    expect(result.sidecar.issues[1].same_problem_as).toBe(0);
    expect(
      result.sidecar.issues[0].signals.map((s: ReportSignal) => s.id),
    ).toEqual(['s1', 's4']);
  });

  it('shows under its issue the same signal raised in a session that did not name it', () => {
    const result = generate([
      {
        area: '/signup',
        persona: 'Beginner',
        overall_impression: 'stuck',
        issues: [issue({ description: 'Sign up is broken', signal: 's1' })],
        signals: [signup500('s1', 2)],
      },
      {
        area: '/',
        persona: 'Skimmer',
        overall_impression: 'fine',
        issues: [],
        signals: [signup500('s1', 3)],
      },
    ]);
    expect(result.markdown).not.toContain('## Detected automatically');
    expect(result.signal_counts.total).toBe(0);
    expect(result.confirmed_major_signals).toBe(0);
    expect(result.markdown.split('/api/signup answered 500').length - 1).toBe(
      1,
    );
  });

  it('lists one contrast rule broken on several pages and sessions once', () => {
    const result = generate([
      {
        area: '/',
        persona: 'Beginner',
        overall_impression: 'ok',
        issues: [],
        signals: [contrast('s1', '/', 4), contrast('s2', '/login', 2)],
      },
      {
        area: '/signup',
        persona: 'Power user',
        overall_impression: 'ok',
        issues: [],
        signals: [contrast('s1', '/', 4), contrast('s3', '/signup', 3)],
      },
    ]);
    const lines = result.automatic
      .split('\n')
      .filter((l) => l.startsWith('- '));
    expect(lines).toEqual([
      '- [MAJOR] Elements must meet minimum color contrast ratio thresholds (on 3 pages) — `http://localhost:3000/`, `http://localhost:3000/login`, `http://localhost:3000/signup` (step 0, 4 times)',
    ]);
    expect(result.signal_counts).toEqual({ total: 1, major: 1, minor: 0 });
    expect(result.confirmed_major_signals).toBe(1);
    // The sidecar keeps every signal as it came.
    expect(result.sidecar.signals).toHaveLength(4);
  });

  it('keeps apart what only looks alike', () => {
    const result = generate([
      {
        area: '/',
        persona: 'Beginner',
        overall_impression: 'ok',
        issues: [],
        signals: [
          signup500('s1', 1),
          {
            ...signup500('s2', 1),
            status: 502,
            message: 'POST /api/signup answered 502',
          },
          {
            ...signup500('s3', 1),
            method: 'GET',
            message: 'GET /api/signup answered 500',
          },
          {
            id: 's4',
            kind: 'dead_control',
            url: 'http://localhost:3000/',
            step: 2,
            message: 'Clicking the button "Save" changed nothing',
            severity: 'major',
            count: 1,
            role: 'button',
            name: 'Save',
          },
          {
            id: 's5',
            kind: 'dead_control',
            url: 'http://localhost:3000/settings',
            step: 3,
            message: 'Clicking the button "Save" changed nothing',
            severity: 'major',
            count: 1,
            role: 'button',
            name: 'Save',
          },
        ],
      },
    ]);
    expect(result.signal_counts.total).toBe(5);
  });

  it('does not count a slow endpoint twice because it was slow by different amounts', () => {
    const slow = (id: string, seconds: string): ReportSignal => ({
      id,
      kind: 'slow_response',
      url: 'http://localhost:3000/',
      step: 1,
      message: `GET /api/feed took ${seconds} to answer`,
      severity: 'minor',
      count: 1,
      method: 'GET',
      request_url: 'http://localhost:3000/api/feed',
    });
    expect(signalKey(slow('s1', '3.2 s'))).toBe(signalKey(slow('s2', '4.1 s')));
  });
});
