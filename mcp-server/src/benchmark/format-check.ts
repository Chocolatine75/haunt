// mcp-server/src/benchmark/format-check.ts
//
// The report format is code-generated (engine/report/generate-report.ts), not
// LLM-authored — so checking it against the documented contract is a
// mechanical string check, not a judgment call. No LLM call here.

export interface FormatCheckResult {
  ok: boolean;
  missing: string[];
}

const REQUIRED_FRONTMATTER_FIELDS = [
  'haunt:',
  'target:',
  'date:',
  'areas_tested:',
  'issues:',
  'top_fix:',
];

const REQUIRED_SECTION_HEADERS = [
  '## Issues',
  '## Session Impressions',
  '## For Claude',
];

export function checkReportFormat(markdown: string): FormatCheckResult {
  const missing: string[] = [];

  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    missing.push('frontmatter block (--- ... ---)');
  } else {
    const frontmatter = frontmatterMatch[1];
    for (const field of REQUIRED_FRONTMATTER_FIELDS) {
      if (!frontmatter.includes(field)) {
        missing.push(`frontmatter field "${field}"`);
      }
    }
  }

  for (const header of REQUIRED_SECTION_HEADERS) {
    if (!markdown.includes(header)) {
      missing.push(`section "${header}"`);
    }
  }

  return { ok: missing.length === 0, missing };
}
