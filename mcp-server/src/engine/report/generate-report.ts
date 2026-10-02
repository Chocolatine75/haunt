// mcp-server/src/engine/report/generate-report.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { REPORTS_DIR } from '../constants.js';
import type { Issue, IssueSeverity } from '../types.js';

export interface SessionResult {
  area: string;
  persona: string;
  overall_impression: string;
  issues: Issue[];
  sandbox_blocked_requests?: string[];
}

export interface GenerateReportInput {
  target_url: string;
  personas: string[];
  sessions: SessionResult[];
  // Injectable for tests; defaults to today (UTC) when omitted.
  date?: string;
  // Path to a previous report (its .md path, or the .json sidecar directly) to
  // diff against — annotates which issues are new vs. still present, and which
  // ones from that run are gone. Optional; a missing/unreadable file is reported
  // back as comparison_error rather than failing report generation.
  compare_with?: string;
}

export interface IssueCounts {
  total: number;
  critical: number;
  major: number;
  minor: number;
  suggestion: number;
}

export interface ComparisonResult {
  compared_with: string;
  resolved: Issue[];
  still_present_count: number;
  new_count: number;
}

export interface GenerateReportOutput {
  report_path: string;
  markdown: string;
  summary: string;
  counts: IssueCounts;
  top_fix: string;
  comparison?: ComparisonResult;
  comparison_error?: string;
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

// Issue descriptions are free LLM text and can reword slightly between runs, so
// exact-string matching would under-count "the same issue" across two reports.
// page_url + category + severity is a coarser but more stable proxy — it can
// merge two distinct issues on the same page/category/severity into one match,
// which is a real limitation, not a precise diff.
function issueKey(issue: Issue): string {
  return `${issue.page_url}||${issue.category}||${issue.severity}`;
}

function sidecarPathFor(reportPath: string): string {
  return reportPath.endsWith('.md')
    ? `${reportPath.slice(0, -3)}.json`
    : `${reportPath}.json`;
}

function loadPreviousIssues(compareWith: string): Issue[] {
  const sidecarPath = compareWith.endsWith('.json')
    ? compareWith
    : sidecarPathFor(compareWith);
  if (!existsSync(sidecarPath)) {
    throw new Error(`No sidecar data found at ${sidecarPath}`);
  }
  const parsed = JSON.parse(readFileSync(sidecarPath, 'utf-8'));
  if (!Array.isArray(parsed.issues)) {
    throw new Error(`${sidecarPath} does not contain an issues array`);
  }
  return parsed.issues as Issue[];
}

function compareIssues(
  oldIssues: Issue[],
  newIssues: Issue[],
  compareWith: string,
): ComparisonResult {
  const oldKeys = new Set(oldIssues.map(issueKey));
  const newKeys = new Set(newIssues.map(issueKey));
  return {
    compared_with: compareWith,
    resolved: oldIssues.filter((i) => !newKeys.has(issueKey(i))),
    still_present_count: newIssues.filter((i) => oldKeys.has(issueKey(i)))
      .length,
    new_count: newIssues.filter((i) => !oldKeys.has(issueKey(i))).length,
  };
}

function renderIssueBlock(
  issue: Issue,
  index: number,
  previousKeys: Set<string> | undefined,
): string {
  const statusTag = previousKeys
    ? previousKeys.has(issueKey(issue))
      ? ' _(still present)_'
      : ' _(new)_'
    : '';
  const lines = [
    `### ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.description}${statusTag}`,
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

function renderComparisonSection(comparison: ComparisonResult): string {
  const lines = [
    `Compared with \`${comparison.compared_with}\`: ${comparison.still_present_count} still present, ${comparison.new_count} new, ${comparison.resolved.length} resolved.`,
  ];
  if (comparison.resolved.length > 0) {
    lines.push('');
    lines.push('Resolved since then:');
    for (const issue of comparison.resolved) {
      lines.push(
        `- [${issue.severity.toUpperCase()}] ${issue.description} (\`${issue.page_url}\`)`,
      );
    }
  }
  return lines.join('\n');
}

function renderSandboxBlockedSection(blocked: string[]): string {
  return blocked.map((entry) => `- ${entry}`).join('\n');
}

function renderSummary(
  sessions: SessionResult[],
  sortedIssues: Issue[],
  counts: IssueCounts,
  topFix: string,
  reportPath: string,
  comparison: ComparisonResult | undefined,
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

  if (comparison) {
    lines.push(
      `vs previous run: ${comparison.still_present_count} still present · ${comparison.new_count} new · ${comparison.resolved.length} resolved`,
      '',
    );
  }

  lines.push(`report: ${reportPath}`, rule);
  return lines.join('\n');
}

export function hauntGenerateReport(
  input: GenerateReportInput,
): GenerateReportOutput {
  const date = input.date ?? todayISODate();
  const allIssues = input.sessions.flatMap((s) => s.issues);
  const allBlockedRequests = input.sessions.flatMap(
    (s) => s.sandbox_blocked_requests ?? [],
  );
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

  let comparison: ComparisonResult | undefined;
  let comparison_error: string | undefined;
  let previousIssues: Issue[] | undefined;
  if (input.compare_with) {
    try {
      previousIssues = loadPreviousIssues(input.compare_with);
      comparison = compareIssues(previousIssues, sorted, input.compare_with);
    } catch (error) {
      comparison_error = error instanceof Error ? error.message : String(error);
    }
  }
  const previousKeys = previousIssues
    ? new Set(previousIssues.map(issueKey))
    : undefined;

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
    ? sorted
        .map((issue, i) => renderIssueBlock(issue, i, previousKeys))
        .join('\n\n')
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

  if (comparison) {
    bodySections.push(
      '',
      '## Comparison',
      '',
      renderComparisonSection(comparison),
    );
  } else if (comparison_error) {
    bodySections.push(
      '',
      '## Comparison',
      '',
      `Could not compare with \`${input.compare_with}\`: ${comparison_error}`,
    );
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

  if (allBlockedRequests.length > 0) {
    bodySections.push(
      '',
      '## Sandbox-Blocked Requests',
      '',
      'These are not app bugs — the test sandbox blocked an attempt to reach an origin outside the target app, shown here for visibility into what the persona tried.',
      '',
      renderSandboxBlockedSection(allBlockedRequests),
    );
  }

  const markdown = bodySections.join('\n');

  mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(report_path, markdown, 'utf-8');
  writeFileSync(
    sidecarPathFor(report_path),
    JSON.stringify(
      {
        target_url: input.target_url,
        date,
        personas: input.personas,
        issues: sorted,
      },
      null,
      2,
    ),
    'utf-8',
  );

  const summary = renderSummary(
    input.sessions,
    sorted,
    counts,
    top_fix,
    report_path,
    comparison,
  );

  return {
    report_path,
    markdown,
    summary,
    counts,
    top_fix,
    comparison,
    comparison_error,
  };
}
