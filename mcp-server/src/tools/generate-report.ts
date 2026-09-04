// mcp-server/src/tools/generate-report.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { REPORTS_DIR } from '../constants.js';
import type { Issue, IssueSeverity } from '../types.js';

export interface SessionResult {
  area: string;
  persona: string;
  overall_impression: string;
  issues: Issue[];
}

export interface GenerateReportInput {
  target_url: string;
  personas: string[];
  sessions: SessionResult[];
  // Injectable for tests; defaults to today (UTC) when omitted.
  date?: string;
}

export interface IssueCounts {
  total: number;
  critical: number;
  major: number;
  minor: number;
  suggestion: number;
}

export interface GenerateReportOutput {
  report_path: string;
  markdown: string;
  summary: string;
  counts: IssueCounts;
  top_fix: string;
}

const SEVERITY_ORDER: IssueSeverity[] = [
  'critical',
  'major',
  'minor',
  'suggestion',
];

// Next.js App Router file-path heuristic from the original prompt. Auth-adjacent
// routes map to lib/auth.ts rather than a page file; anything unparseable is left
// undefined rather than guessed — a wrong file suggestion is worse than none.
function likelyFile(pageUrl: string): string | undefined {
  let path: string;
  try {
    path = new URL(pageUrl).pathname;
  } catch {
    if (!pageUrl.startsWith('/')) return undefined;
    path = pageUrl;
  }
  if (!path) return undefined;

  if (/\/(login|sign-?in|sign-?up|register|auth|session)(\/|$)/i.test(path)) {
    return 'lib/auth.ts';
  }
  if (path === '/') return 'app/page.tsx';
  if (path.startsWith('/api/')) return `app${path}/route.ts`;
  return `app${path}/page.tsx`;
}

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function countBySeverity(issues: Issue[]): IssueCounts {
  return {
    total: issues.length,
    critical: issues.filter((i) => i.severity === 'critical').length,
    major: issues.filter((i) => i.severity === 'major').length,
    minor: issues.filter((i) => i.severity === 'minor').length,
    suggestion: issues.filter((i) => i.severity === 'suggestion').length,
  };
}

function renderIssueBlock(issue: Issue, index: number): string {
  const lines = [
    `### ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`,
    `- **Page:** \`${issue.page_url}\``,
    `- **Fix:** ${issue.recommendation}`,
  ];
  const file = likelyFile(issue.page_url);
  if (file) {
    lines.push(
      `- **Likely file:** \`${file}\` *(AI estimate — verify before editing)*`,
    );
  }
  return lines.join('\n');
}

function renderForClaudeLine(issue: Issue, index: number): string {
  const file = likelyFile(issue.page_url);
  const fileSuffix = file ? ` Likely in \`${file}\`.` : '';
  return `${index + 1}. [${issue.severity.toUpperCase()}] \`${issue.page_url}\` — ${issue.recommendation}.${fileSuffix}`;
}

function renderSummary(
  sessions: SessionResult[],
  sortedIssues: Issue[],
  counts: IssueCounts,
  topFix: string,
  reportPath: string,
): string {
  const rule = '-'.repeat(40);
  const lines = [
    rule,
    `${sessions.length} areas tested · ${counts.total} issues`,
    '',
  ];

  if (counts.critical > 0) lines.push(`[!!!] ${counts.critical} critical`);
  if (counts.major > 0) lines.push(` [!!] ${counts.major} major`);
  if (counts.minor > 0) lines.push(`  [!] ${counts.minor} minor`);
  lines.push('');

  if (counts.critical > 0) {
    for (const issue of sortedIssues) {
      if (issue.severity !== 'critical') continue;
      lines.push(`> ${issue.description}  [${issue.page_url}]`);
    }
  } else {
    lines.push('no critical issues');
  }
  lines.push('');

  if (counts.total > 0) {
    lines.push(`fix first: ${topFix}`, '');
  }

  lines.push(`report: ${reportPath}`, rule);
  return lines.join('\n');
}

export function hauntGenerateReport(
  input: GenerateReportInput,
): GenerateReportOutput {
  const date = input.date ?? todayISODate();
  const allIssues = input.sessions.flatMap((s) => s.issues);
  const sorted = [...allIssues].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
  const counts = countBySeverity(allIssues);
  const top_fix = sorted[0]?.recommendation ?? '';

  const personaSlug = input.personas
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');
  const report_path = `${REPORTS_DIR}/${date}-${personaSlug}.md`;

  const frontmatter = [
    '---',
    'haunt: true',
    `target: ${input.target_url}`,
    `date: ${date}`,
    `personas: [${input.personas.join(', ')}]`,
    `areas_tested: ${input.sessions.length}`,
    'issues:',
    `  total: ${counts.total}`,
    `  critical: ${counts.critical}`,
    `  major: ${counts.major}`,
    `  minor: ${counts.minor}`,
    `top_fix: "${top_fix.replace(/"/g, "'")}"`,
    '---',
  ].join('\n');

  const issuesSection = sorted.length
    ? sorted.map(renderIssueBlock).join('\n\n')
    : '_No issues found._';

  const impressionsSection = input.sessions
    .map((s) => `**${s.area} — ${s.persona}:** "${s.overall_impression}"`)
    .join('\n');

  const forClaudeSection = sorted.length
    ? sorted.map(renderForClaudeLine).join('\n')
    : '_No issues found._';

  const bodySections = [
    frontmatter,
    '',
    `# Haunt Report — ${input.target_url}`,
    `${date} · ${input.sessions.length} areas · ${counts.total} issues · ${input.personas.join(', ')}`,
    '',
    '## Issues',
    '',
    issuesSection,
    '',
    '## Session Impressions',
    '',
    impressionsSection,
  ];

  if (counts.total > 0) {
    bodySections.push('', '## Top Fix', '', top_fix);
  }

  bodySections.push(
    '',
    '## For Claude',
    '',
    'The following issues were found by Haunt. Fix them in order of severity.',
    '',
    forClaudeSection,
    '',
    `After fixing, run \`/haunt:haunt-test ${input.target_url}\` again to verify.`,
  );

  const markdown = bodySections.join('\n');

  mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(report_path, markdown, 'utf-8');

  const summary = renderSummary(
    input.sessions,
    sorted,
    counts,
    top_fix,
    report_path,
  );

  return { report_path, markdown, summary, counts, top_fix };
}
