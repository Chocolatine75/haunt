// mcp-server/src/reporter/generator.ts
import type { EndSessionOutput } from '../tools/end-session.js';
import type { Issue, IssueSeverity } from '../types.js';

const SEVERITY_ORDER: IssueSeverity[] = ['critical', 'major', 'minor', 'suggestion'];

function formatIssue(issue: Issue, index: number): string {
  return [
    `#### Issue ${index + 1}: ${issue.description}`,
    `- **Severity:** ${issue.severity}`,
    `- **Category:** ${issue.category}`,
    `- **Page:** ${issue.page_url}`,
    `- **Recommendation:** ${issue.recommendation}`,
    issue.screenshot_path ? `- **Screenshot:** \`${issue.screenshot_path}\`` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatSession(session: EndSessionOutput): string {
  const issuesBlock =
    session.issues_found.length === 0
      ? 'No issues found.'
      : [...session.issues_found]
          .sort(
            (a, b) =>
              SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
          )
          .map((issue, i) => formatIssue(issue, i))
          .join('\n\n');

  return [
    `### ${session.persona}`,
    `${session.step_count} steps · ${session.duration_seconds}s · ${session.pages_visited} pages visited`,
    '',
    `**Overall impression:** ${session.overall_impression}`,
    '',
    issuesBlock,
  ].join('\n');
}

export function generateReport(sessions: EndSessionOutput[], targetUrl: string): string {
  const date = new Date().toISOString().split('T')[0];
  const allIssues = sessions.flatMap((s) => s.issues_found);

  const summary =
    SEVERITY_ORDER.map((sev) => {
      const count = allIssues.filter((i) => i.severity === sev).length;
      return count > 0 ? `${count} ${sev}` : null;
    })
      .filter(Boolean)
      .join(' · ') || 'No issues';

  return [
    `# Haunt Report — ${targetUrl}`,
    `Date: ${date}`,
    '',
    '## Summary',
    `- **Personas tested:** ${sessions.map((s) => s.persona).join(', ')}`,
    `- **Total issues:** ${allIssues.length} (${summary})`,
    '',
    '## Results by Persona',
    '',
    sessions.map(formatSession).join('\n\n---\n\n'),
  ].join('\n');
}
