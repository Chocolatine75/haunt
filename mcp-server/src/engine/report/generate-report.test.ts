import { readFileSync, rmSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { REPORTS_DIR } from '../constants.js';
import type { Issue } from '../types.js';
import { hauntGenerateReport } from './generate-report.js';

function issue(overrides: Partial<Issue>): Issue {
  return {
    severity: 'minor',
    category: 'ux',
    description: 'Something is off',
    page_url: '/somewhere',
    recommendation: 'Fix it',
    ...overrides,
  };
}

afterAll(() => {
  rmSync(REPORTS_DIR, { recursive: true, force: true });
});

describe('hauntGenerateReport', () => {
  it('counts issues by severity and sorts critical first', () => {
    const result = hauntGenerateReport({
      target_url: 'http://localhost:3000',
      personas: ['confused-beginner'],
      date: '2026-01-01',
      sessions: [
        {
          area: '/signup',
          persona: 'Confused Beginner',
          overall_impression: 'Got stuck.',
          issues: [
            issue({ severity: 'minor', description: 'minor one' }),
            issue({ severity: 'critical', description: 'critical one' }),
            issue({ severity: 'major', description: 'major one' }),
          ],
        },
      ],
    });

    expect(result.counts).toEqual({
      total: 3,
      critical: 1,
      major: 1,
      minor: 1,
      suggestion: 0,
    });
    // Sorted section: critical block must appear before major, before minor
    const criticalIdx = result.markdown.indexOf('[CRITICAL] critical one');
    const majorIdx = result.markdown.indexOf('[MAJOR] major one');
    const minorIdx = result.markdown.indexOf('[MINOR] minor one');
    expect(criticalIdx).toBeGreaterThan(-1);
    expect(criticalIdx).toBeLessThan(majorIdx);
    expect(majorIdx).toBeLessThan(minorIdx);
    // Numbered sequentially starting at 1, critical first
    expect(result.markdown).toContain('### 1. [CRITICAL] critical one');
    expect(result.markdown).toContain('### 2. [MAJOR] major one');
    expect(result.markdown).toContain('### 3. [MINOR] minor one');
  });

  it("picks the highest-severity issue's recommendation as top_fix", () => {
    const result = hauntGenerateReport({
      target_url: 'http://localhost:3000',
      personas: ['confused-beginner'],
      date: '2026-01-01',
      sessions: [
        {
          area: '/signup',
          persona: 'Confused Beginner',
          overall_impression: '',
          issues: [
            issue({ severity: 'minor', recommendation: 'minor fix' }),
            issue({ severity: 'critical', recommendation: 'critical fix' }),
          ],
        },
      ],
    });

    expect(result.top_fix).toBe('critical fix');
  });

  it('maps page_url to a likely file using the Next.js App Router heuristic', () => {
    const result = hauntGenerateReport({
      target_url: 'http://localhost:3000',
      personas: ['confused-beginner'],
      date: '2026-01-01',
      sessions: [
        {
          area: '/mixed',
          persona: 'Confused Beginner',
          overall_impression: '',
          issues: [
            issue({
              severity: 'critical',
              page_url: 'http://localhost:3000/pricing',
            }),
            issue({ severity: 'major', page_url: '/api/users' }),
            issue({ severity: 'minor', page_url: '/login' }),
            issue({
              severity: 'suggestion',
              page_url: 'http://localhost:3000/',
            }),
          ],
        },
      ],
    });

    expect(result.markdown).toContain('`app/pricing/page.tsx`');
    expect(result.markdown).toContain('`app/api/users/route.ts`');
    expect(result.markdown).toContain('`lib/auth.ts`');
    expect(result.markdown).toContain('`app/page.tsx`');
  });

  it('omits Likely file rather than guessing when page_url is unparseable', () => {
    const result = hauntGenerateReport({
      target_url: 'http://localhost:3000',
      personas: ['confused-beginner'],
      date: '2026-01-01',
      sessions: [
        {
          area: '/weird',
          persona: 'Confused Beginner',
          overall_impression: '',
          issues: [issue({ severity: 'minor', page_url: 'not a url or path' })],
        },
      ],
    });

    expect(result.markdown).not.toContain('Likely file');
  });

  it('omits Top Fix and prints "no critical issues" when there are no issues', () => {
    const result = hauntGenerateReport({
      target_url: 'http://localhost:3000',
      personas: ['confused-beginner'],
      date: '2026-01-01',
      sessions: [
        {
          area: '/fine',
          persona: 'Confused Beginner',
          overall_impression: 'All good.',
          issues: [],
        },
      ],
    });

    expect(result.markdown).not.toContain('## Top Fix');
    expect(result.summary).toContain('no critical issues');
    expect(result.summary).not.toContain('fix first:');
  });

  it('builds the report path from date and persona names, and writes the file', () => {
    const result = hauntGenerateReport({
      target_url: 'http://localhost:3000',
      personas: ['confused-beginner', 'malicious-user'],
      date: '2026-03-14',
      sessions: [
        {
          area: '/x',
          persona: 'Confused Beginner',
          overall_impression: '',
          issues: [],
        },
      ],
    });

    expect(result.report_path).toBe(
      `${REPORTS_DIR}/2026-03-14-confused-beginner-malicious-user.md`,
    );
    expect(readFileSync(result.report_path, 'utf-8')).toBe(result.markdown);
  });

  it('formats the terminal summary with right-aligned severity brackets and critical lines', () => {
    const result = hauntGenerateReport({
      target_url: 'http://localhost:3000',
      personas: ['confused-beginner'],
      date: '2026-01-01',
      sessions: [
        { area: '/a', persona: 'p', overall_impression: '', issues: [] },
        { area: '/b', persona: 'p', overall_impression: '', issues: [] },
      ],
      // 2 sessions above are just for areas_tested; issues live on a 3rd
    });
    const withIssues = hauntGenerateReport({
      target_url: 'http://localhost:3000',
      personas: ['confused-beginner'],
      date: '2026-01-01',
      sessions: [
        {
          area: '/a',
          persona: 'p',
          overall_impression: '',
          issues: [
            issue({
              severity: 'critical',
              description: 'XSS in comment field',
              page_url: '/comments',
              recommendation: 'Sanitize input',
            }),
          ],
        },
      ],
    });

    expect(result.summary).toContain('2 areas tested · 0 issues');
    expect(withIssues.summary).toContain('[!!!] 1 critical');
    expect(withIssues.summary).toContain('> XSS in comment field  [/comments]');
    expect(withIssues.summary).toContain('fix first: Sanitize input');
  });

  it('writes a JSON sidecar with the sorted issues alongside the markdown', () => {
    const result = hauntGenerateReport({
      target_url: 'http://localhost:3000',
      personas: ['confused-beginner'],
      date: '2026-02-02',
      sessions: [
        {
          area: '/a',
          persona: 'p',
          overall_impression: '',
          issues: [issue({ severity: 'critical', description: 'boom' })],
        },
      ],
    });

    const sidecarPath = result.report_path.replace(/\.md$/, '.json');
    const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf-8'));
    expect(sidecar.issues).toHaveLength(1);
    expect(sidecar.issues[0].description).toBe('boom');
  });

  describe('compare_with', () => {
    it('tags issues as still present vs. new, and lists resolved ones', () => {
      const first = hauntGenerateReport({
        target_url: 'http://localhost:3000',
        personas: ['confused-beginner'],
        date: '2026-04-01',
        sessions: [
          {
            area: '/a',
            persona: 'p',
            overall_impression: '',
            issues: [
              issue({
                severity: 'critical',
                description: 'XSS in comments',
                page_url: '/comments',
                category: 'security',
              }),
              issue({
                severity: 'minor',
                description: 'Missing alt text',
                page_url: '/gallery',
                category: 'accessibility',
              }),
            ],
          },
        ],
      });

      const second = hauntGenerateReport({
        target_url: 'http://localhost:3000',
        personas: ['confused-beginner'],
        date: '2026-04-08',
        compare_with: first.report_path,
        sessions: [
          {
            area: '/a',
            persona: 'p',
            overall_impression: '',
            issues: [
              // Same page/category/severity as before — still present
              issue({
                severity: 'critical',
                description: 'XSS in comments (still reproduces)',
                page_url: '/comments',
                category: 'security',
              }),
              // Not in the first run — new
              issue({
                severity: 'major',
                description: 'Broken checkout button',
                page_url: '/checkout',
                category: 'ux',
              }),
            ],
          },
        ],
      });

      expect(second.comparison?.still_present_count).toBe(1);
      expect(second.comparison?.new_count).toBe(1);
      expect(second.comparison?.resolved).toHaveLength(1);
      expect(second.comparison?.resolved[0].description).toBe(
        'Missing alt text',
      );
      expect(second.markdown).toContain('(still present)');
      expect(second.markdown).toContain('(new)');
      expect(second.markdown).toContain('## Comparison');
      expect(second.summary).toContain(
        'vs previous run: 1 still present · 1 new · 1 resolved',
      );
    });

    it('reports comparison_error instead of failing when the target is missing', () => {
      const result = hauntGenerateReport({
        target_url: 'http://localhost:3000',
        personas: ['confused-beginner'],
        date: '2026-04-01',
        compare_with: `${REPORTS_DIR}/2020-01-01-nonexistent.md`,
        sessions: [
          { area: '/a', persona: 'p', overall_impression: '', issues: [] },
        ],
      });

      expect(result.comparison).toBeUndefined();
      expect(result.comparison_error).toMatch(/No sidecar data found/);
      expect(result.markdown).toContain('Could not compare with');
    });
  });

  it('renders a Sandbox-Blocked Requests section when any session has blocked requests', () => {
    const result = hauntGenerateReport({
      target_url: 'http://localhost:3000',
      personas: ['malicious-user'],
      date: '2026-01-01',
      sessions: [
        {
          area: '/admin',
          persona: 'Malicious User',
          overall_impression: 'Tried to pivot elsewhere.',
          issues: [],
          sandbox_blocked_requests: ['GET http://evil.example/exfil (blocked)'],
        },
      ],
    });

    expect(result.markdown).toContain('## Sandbox-Blocked Requests');
    expect(result.markdown).toContain(
      'GET http://evil.example/exfil (blocked)',
    );
  });

  it('omits the Sandbox-Blocked Requests section when nothing was blocked', () => {
    const result = hauntGenerateReport({
      target_url: 'http://localhost:3000',
      personas: ['confused-beginner'],
      date: '2026-01-01',
      sessions: [
        {
          area: '/',
          persona: 'Confused Beginner',
          overall_impression: 'All good.',
          issues: [],
        },
      ],
    });

    expect(result.markdown).not.toContain('## Sandbox-Blocked Requests');
  });

  describe('signals', () => {
    const signal = (
      id: string,
      severity: 'major' | 'minor',
      message: string,
    ) => ({
      id,
      kind: 'http_error',
      url: 'http://localhost:3000/orders',
      step: 2,
      message,
      severity,
      count: id === 's2' ? 3 : 1,
      status: 500,
    });

    it('lists the signals no issue names in a section of their own, and counts them', () => {
      const result = hauntGenerateReport({
        target_url: 'http://localhost:3000',
        personas: ['signals'],
        date: '2026-01-02',
        sessions: [
          {
            area: '/orders',
            persona: 'Tester',
            overall_impression: 'ok',
            issues: [
              issue({
                severity: 'critical',
                description: 'Orders never load',
                signal: 's1',
              }),
            ],
            signals: [
              signal('s1', 'major', 'GET /api/orders answered 500'),
              signal('s2', 'minor', 'GET /api/logo.png answered 404'),
              signal('s3', 'major', 'GET /api/export answered 503'),
            ],
          },
        ],
      });
      const section = result.markdown.split('## Detected automatically')[1];
      expect(section).toContain(
        '- [MAJOR] GET /api/export answered 503 — `http://localhost:3000/orders` (step 2)',
      );
      expect(section).toContain(
        'answered 404 — `http://localhost:3000/orders` (step 2, 3 times)',
      );
      // The named one is under its issue, and only there.
      expect(result.markdown.split('/api/orders').length - 1).toBe(1);
      expect(result.markdown).toContain(
        '- **Detected:** [MAJOR] GET /api/orders answered 500',
      );
      expect(result.signal_counts).toEqual({ total: 2, major: 1, minor: 1 });
      expect(result.markdown).toContain('signals:\n  total: 2\n  major: 1');
      expect(result.summary).toContain(
        '2 more detected automatically (1 major)',
      );

      const sidecar = JSON.parse(
        readFileSync(result.report_path.replace(/\.md$/, '.json'), 'utf-8'),
      );
      expect(sidecar.signals).toHaveLength(3);
      // Fields the report does not use go to the sidecar as they came.
      expect(sidecar.signals[0].status).toBe(500);
      expect(
        sidecar.issues[0].signals.map((s: { id: string }) => s.id),
      ).toEqual(['s1']);
      expect(sidecar.signal_counts).toEqual(result.signal_counts);
    });

    it('has no such section, and says nothing of signals, when there are none', () => {
      const result = hauntGenerateReport({
        target_url: 'http://localhost:3000',
        personas: ['no-signals'],
        date: '2026-01-03',
        sessions: [
          {
            area: '/',
            persona: 'Tester',
            overall_impression: 'ok',
            // An id that names nothing is ignored.
            issues: [issue({ signal: 's9' })],
          },
        ],
      });
      expect(result.markdown).not.toContain('Detected automatically');
      expect(result.markdown).not.toContain('**Detected:**');
      expect(result.summary).not.toContain('detected automatically');
      expect(result.signal_counts).toEqual({ total: 0, major: 0, minor: 0 });
    });
  });
});
