// mcp-server/src/reporter/generator.ts
import type { EndSessionOutput } from '../tools/end-session.js';
import type { Issue, IssueSeverity } from '../types.js';

const SEVERITY_ORDER: IssueSeverity[] = ['critical', 'major', 'minor', 'suggestion'];

const SEVERITY_EMOJI: Record<IssueSeverity, string> = {
  critical: '🔴',
  major: '🟠',
  minor: '🟡',
  suggestion: '💭',
};

const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  suggestion: 'Suggestions',
};

const SEVERITY_SUBTEXT: Record<IssueSeverity, string> = {
  critical: 'Fix these before shipping.',
  major: 'Significant UX or functional problems.',
  minor: 'Polish items — fix when you have time.',
  suggestion: 'Nice-to-haves.',
};

function formatIssueBlock(issues: Issue[], startIndex: number): string {
  return issues
    .map((issue, i) => {
      const n = startIndex + i + 1;
      const lines = [`**${n}. ${issue.description}**`, `- Page: \`${issue.page_url}\``, `- ${issue.recommendation}`];
      if (issue.screenshot_path) lines.push(`- Screenshot: \`${issue.screenshot_path}\``);
      return lines.join('\n');
    })
    .join('\n\n');
}

function formatSeveritySection(issues: Issue[], severity: IssueSeverity, startIndex: number): string {
  if (issues.length === 0) return '';
  return [
    `## ${SEVERITY_EMOJI[severity]} ${SEVERITY_LABEL[severity]} (${issues.length})`,
    `> ${SEVERITY_SUBTEXT[severity]}`,
    '',
    formatIssueBlock(issues, startIndex),
  ].join('\n');
}

function formatSessionDetails(sessions: EndSessionOutput[]): string {
  const tableRows = sessions
    .map((s) => `| ${s.pages_visited[0] ?? '/'} | ${s.persona} | ${s.step_count} | ${s.duration_seconds}s | ${s.issues_found.length} |`)
    .join('\n');

  const table = [
    '| Area | Persona | Steps | Duration | Issues |',
    '|------|---------|-------|----------|--------|',
    tableRows,
  ].join('\n');

  const impressions = sessions
    .map((s) => [`### ${s.pages_visited[0] ?? '/'} — ${s.persona}`, `> "${s.overall_impression}"`].join('\n'))
    .join('\n\n');

  return ['## Session Details', '', table, '', impressions].join('\n');
}

function findTopFix(sessions: EndSessionOutput[]): string {
  const criticals = sessions.flatMap((s) => s.issues_found).filter((i) => i.severity === 'critical');
  if (criticals.length === 0) return 'No critical issues found — focus on the major ones listed above.';

  // Pick the recommendation that appears most commonly or first critical
  return criticals[0].recommendation;
}

export function generateReport(sessions: EndSessionOutput[], targetUrl: string): string {
  const date = new Date().toISOString().split('T')[0];
  const allIssues = sessions.flatMap((s) => s.issues_found);
  const personas = [...new Set(sessions.map((s) => s.persona))].join(', ');

  const header = [
    `# 👻 Haunt Report — ${targetUrl}`,
    `\`${date}\` · ${sessions.length} areas · ${allIssues.length} issues · ${personas}`,
  ].join('\n');

  const sections: string[] = [];
  let runningIndex = 0;

  for (const sev of SEVERITY_ORDER) {
    const issues = allIssues.filter((i) => i.severity === sev);
    const section = formatSeveritySection(issues, sev, runningIndex);
    if (section) {
      sections.push(section);
      runningIndex += issues.length;
    }
  }

  const topFix = `⚡ **Top fix:** ${findTopFix(sessions)}`;

  return [header, '---', ...sections.map((s) => s + '\n\n---'), formatSessionDetails(sessions), '---', topFix].join(
    '\n\n',
  );
}
