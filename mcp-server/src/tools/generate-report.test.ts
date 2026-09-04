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
});
