// mcp-server/src/engine/report/generate-report.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { REPORTS_DIR } from '../constants.js';
import type { Issue, IssueSeverity } from '../types.js';
import { groupBy, renderSignalGroup, signalKey } from './group.js';

// What the report needs of a verification (gates/part-3/contract.ts has the
// whole shape).
export interface ReportVerification {
  status: 'confirmed' | 'flaky' | 'rejected' | 'unverified';
  attempts: number;
  reproduced: number;
  rate: number;
  bundle?: string;
  reason?: string;
}

// What the report needs of a signal (gates/part-2/contract.ts has the whole
// shape); the rest of its fields go to the sidecar as they came, and those
// of its kind tell two signals of the same problem apart (group.ts).
export interface ReportSignal {
  id: string;
  kind: string;
  url: string;
  step: number;
  message: string;
  severity: 'major' | 'minor';
  count: number;
  method?: string;
  request_url?: string;
  status?: number;
  error?: string;
  rule?: string;
  help?: string;
  role?: string;
  name?: string;
}

// An issue as haunt_end_session returns it: with its verification (part 3).
// One without is taken as it comes, as before part 3.
export type ReportIssue = Issue & { verification?: ReportVerification };

export interface SessionResult {
  area: string;
  persona: string;
  overall_impression: string;
  issues: ReportIssue[];
  // Issues verification rejected: in the sidecar only.
  rejected?: ReportIssue[];
  sandbox_blocked_requests?: string[];
  // Every signal of the session (haunt_end_session's), part 2, and how each
  // fared when replayed, by id (part 3). A signal without is taken as
  // confirmed, as before part 3.
  signals?: ReportSignal[];
  signal_verification?: Record<string, ReportVerification>;
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

// Signals no issue names, by default severity, one per problem: the same
// signal raised on several pages or in several sessions counts once.
export interface SignalCounts {
  total: number;
  major: number;
  minor: number;
}

// The heading of the signals no issue names (R-S21).
export const SIGNALS_HEADING = 'Detected automatically';
// The headings of issues a replay reproduced only sometimes, or that could
// not be replayed in time (R-E12).
export const FLAKY_HEADING = 'Flaky';
export const UNVERIFIED_HEADING = 'Unverified';

const statusOf = (item: { verification?: ReportVerification }) =>
  item.verification?.status ?? 'confirmed';

// "reproduced 2 of 10 replays (20%)"
function replays(verification: ReportVerification | undefined): string {
  if (!verification) return '';
  const { reproduced, attempts } = verification;
  return `reproduced ${reproduced} of ${attempts} replays (${Math.round((attempts ? reproduced / attempts : 0) * 100)}%)`;
}

export interface GenerateReportOutput {
  report_path: string;
  markdown: string;
  summary: string;
  counts: IssueCounts;
  signal_counts: SignalCounts;
  // Major signals no issue names that a replay confirmed (R-E12): what
  // haunt-ci's verdict counts along with the issues.
  confirmed_major_signals: number;
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
  signals: ReportSignal[] = [],
  also: Issue[] = [],
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
  for (const group of groupBy(signals, signalKey)) {
    lines.push(`- **Detected:** ${renderSignalGroup(group).slice(2)}`);
  }
  for (const other of also) {
    lines.push(
      `- **Also reported:** ${other.description} (\`${other.page_url}\`)`,
    );
  }
  const verification = (issue as ReportIssue).verification;
  if (verification?.bundle) {
    lines.push(
      `- **Evidence:** \`${verification.bundle}\` — ${replays(verification)}`,
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
  signalCounts: SignalCounts,
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
  if (signalCounts.total > 0) {
    lines.push(
      `${signalCounts.total} more detected automatically (${signalCounts.major} major)`,
      '',
    );
  }

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
  const filed = input.sessions.flatMap((s) => s.issues);
  // Only what a replay confirmed is an issue of the report (R-E12).
  const allIssues = filed.filter((i) => statusOf(i) === 'confirmed');
  const flaky = filed.filter((i) => statusOf(i) === 'flaky');
  const unverified = filed.filter((i) => statusOf(i) === 'unverified');
  const rejectedIssues = [
    ...filed.filter((i) => statusOf(i) === 'rejected'),
    ...input.sessions.flatMap((s) => s.rejected ?? []),
  ];
  const allBlockedRequests = input.sessions.flatMap(
    (s) => s.sandbox_blocked_requests ?? [],
  );
  const sortedFiled = [...allIssues].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  // An issue that names a signal of its session absorbs it, and every signal
  // of the same problem in any session: they are shown under the issue and
  // not again among those detected automatically.
  const signalOf = new Map<Issue, ReportSignal>();
  for (const session of input.sessions) {
    for (const issue of session.issues) {
      const signal = session.signals?.find((s) => s.id === issue.signal);
      if (signal) signalOf.set(issue, signal);
    }
  }
  const takenKeys = new Set(
    filed
      .filter((i) => statusOf(i) !== 'rejected')
      .flatMap((i) => {
        const signal = signalOf.get(i);
        return signal ? [signalKey(signal)] : [];
      }),
  );
  const allSignals = input.sessions.flatMap((s) => s.signals ?? []);
  const unnamed = allSignals.filter((s) => !takenKeys.has(signalKey(s)));
  const unnamedGroups = groupBy(unnamed, signalKey);

  // Issues about the same problem are one entry: the most severe, with the
  // others listed under it as other ways it was reached.
  let unique = 0;
  const issueGroups = groupBy(sortedFiled, (issue) => {
    const signal = signalOf.get(issue);
    return signal ? signalKey(signal) : `issue|${unique++}`;
  });
  const sorted = issueGroups.map(([head]) => head);
  const alsoReported = new Map(
    issueGroups.map(([head, ...rest]) => [head, rest]),
  );
  const named = new Map<Issue, ReportSignal[]>();
  for (const [head, ...rest] of issueGroups) {
    const key = signalOf.has(head)
      ? signalKey(signalOf.get(head) as ReportSignal)
      : undefined;
    if (key === undefined) continue;
    named.set(head, [
      ...[head, ...rest].flatMap((i) => signalOf.get(i) ?? []),
      ...allSignals.filter(
        (s) =>
          signalKey(s) === key &&
          ![head, ...rest].some((i) => signalOf.get(i) === s),
      ),
    ]);
  }
  const counts = countBySeverity(sorted);
  const top_fix = sorted[0]?.recommendation ?? '';

  const groupSeverity = (group: ReportSignal[]) =>
    group.some((s) => s.severity === 'major') ? 'major' : 'minor';
  const signal_counts: SignalCounts = {
    total: unnamedGroups.length,
    major: unnamedGroups.filter((g) => groupSeverity(g) === 'major').length,
    minor: unnamedGroups.filter((g) => groupSeverity(g) === 'minor').length,
  };
  const verificationOf = new Map<ReportSignal, ReportVerification>();
  for (const session of input.sessions) {
    for (const signal of session.signals ?? []) {
      const verification = session.signal_verification?.[signal.id];
      if (verification) verificationOf.set(signal, verification);
    }
  }
  const confirmed_major_signals = unnamedGroups.filter((group) =>
    group.some(
      (s) =>
        s.severity === 'major' &&
        (verificationOf.get(s)?.status ?? 'confirmed') === 'confirmed',
    ),
  ).length;

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
      comparison = compareIssues(
        previousIssues,
        sortedFiled,
        input.compare_with,
      );
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
    'signals:',
    `  total: ${signal_counts.total}`,
    `  major: ${signal_counts.major}`,
    `  minor: ${signal_counts.minor}`,
    `top_fix: "${top_fix.replace(/"/g, "'")}"`,
    '---',
  ].join('\n');

  const issuesSection = sorted.length
    ? sorted
        .map((issue, i) =>
          renderIssueBlock(
            issue,
            i,
            previousKeys,
            named.get(issue),
            alsoReported.get(issue),
          ),
        )
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
  ];

  if (unnamed.length > 0) {
    bodySections.push(
      '',
      `## ${SIGNALS_HEADING}`,
      '',
      'Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.',
      '',
      [...unnamedGroups]
        .sort((a, b) =>
          groupSeverity(a) === groupSeverity(b)
            ? 0
            : groupSeverity(a) === 'major'
              ? -1
              : 1,
        )
        .map(renderSignalGroup)
        .join('\n'),
    );
  }

  const listed = (issue: ReportIssue) =>
    `- [${issue.severity.toUpperCase()}] ${issue.description} (\`${issue.page_url}\`)${issue.verification?.bundle ? ` — evidence: \`${issue.verification.bundle}\`` : ''} — ${replays(issue.verification)}`;
  if (flaky.length > 0) {
    bodySections.push(
      '',
      `## ${FLAKY_HEADING}`,
      '',
      'Replayed in a fresh browser, these happened only some of the time: real, but not every time.',
      '',
      flaky.map(listed).join('\n'),
    );
  }
  if (unverified.length > 0) {
    bodySections.push(
      '',
      `## ${UNVERIFIED_HEADING}`,
      '',
      'Not replayed within the time the session had: not confirmed, and not counted.',
      '',
      unverified.map(listed).join('\n'),
    );
  }

  bodySections.push('', '## Session Impressions', '', impressionsSection);

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
    ...(unnamed.length > 0
      ? ['', `Then fix what is listed under "${SIGNALS_HEADING}".`]
      : []),
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
        // Every issue filed, so that a later comparison matches each; one
        // listed under another says which, by its index here.
        issues: sortedFiled.map((issue) => {
          const head = issueGroups.find((g) => g.includes(issue))?.[0];
          if (head && head !== issue) {
            return { ...issue, same_problem_as: sortedFiled.indexOf(head) };
          }
          return named.has(issue)
            ? { ...issue, signals: named.get(issue) }
            : issue;
        }),
        flaky,
        unverified,
        rejected: rejectedIssues,
        signals: allSignals,
        signal_counts,
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
    signal_counts,
    top_fix,
    report_path,
    comparison,
  );

  return {
    report_path,
    markdown,
    summary,
    counts,
    signal_counts,
    confirmed_major_signals,
    top_fix,
    comparison,
    comparison_error,
  };
}
