// mcp-server/src/reporter/generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateReport } from './generator.js';
import type { EndSessionOutput } from '../tools/end-session.js';

const mockSession: EndSessionOutput = {
  session_id: 'abc-123',
  persona: 'Confused Beginner',
  duration_seconds: 120,
  pages_visited: 5,
  step_count: 12,
  issues_found: [
    {
      severity: 'critical',
      category: 'ux',
      description: 'Login button has no visible label',
      page_url: 'http://localhost:3000/login',
      recommendation: 'Add a visible text label to the login button',
    },
  ],
  overall_impression: 'The app was confusing from the start.',
};

describe('generateReport', () => {
  it('includes persona name in output', () => {
    const report = generateReport([mockSession], 'http://localhost:3000');
    expect(report).toContain('Confused Beginner');
  });

  it('includes issue description', () => {
    const report = generateReport([mockSession], 'http://localhost:3000');
    expect(report).toContain('Login button has no visible label');
  });

  it('includes recommendation', () => {
    const report = generateReport([mockSession], 'http://localhost:3000');
    expect(report).toContain('Add a visible text label');
  });

  it('handles multiple sessions', () => {
    const report = generateReport(
      [mockSession, { ...mockSession, persona: 'Malicious User' }],
      'http://localhost:3000',
    );
    expect(report).toContain('Malicious User');
  });

  it('handles sessions with no issues', () => {
    const report = generateReport(
      [{ ...mockSession, issues_found: [] }],
      'http://localhost:3000',
    );
    expect(report).toContain('No issues found');
  });
});
