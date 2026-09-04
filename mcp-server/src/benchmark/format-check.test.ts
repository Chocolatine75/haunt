import { describe, expect, it } from 'vitest';
import { checkReportFormat } from './format-check.js';

const WELL_FORMED_REPORT = `---
haunt: true
target: http://localhost:3000
date: 2026-01-01
personas: [confused-beginner]
areas_tested: 1
issues:
  total: 1
  critical: 0
  major: 1
  minor: 0
top_fix: "Fix it"
---

# Haunt Report — http://localhost:3000

## Issues

### 1. [MAJOR] Something is broken

## Session Impressions

**/x — Confused Beginner:** "Confusing."

## For Claude

1. [MAJOR] \`/x\` — Fix it.
`;

describe('checkReportFormat', () => {
  it('passes a well-formed report with no missing pieces', () => {
    const result = checkReportFormat(WELL_FORMED_REPORT);
    expect(result).toEqual({ ok: true, missing: [] });
  });

  it('flags a missing frontmatter block entirely', () => {
    const withoutFrontmatter = WELL_FORMED_REPORT.replace(
      /^---[\s\S]*?---\n\n/,
      '',
    );
    const result = checkReportFormat(withoutFrontmatter);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('frontmatter block (--- ... ---)');
  });

  it('flags a missing individual frontmatter field', () => {
    const withoutTopFix = WELL_FORMED_REPORT.replace('top_fix: "Fix it"\n', '');
    const result = checkReportFormat(withoutTopFix);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('frontmatter field "top_fix:"');
  });

  it('flags each missing required section header independently', () => {
    const withoutForClaude = WELL_FORMED_REPORT.replace(
      /## For Claude[\s\S]*/,
      '',
    );
    const result = checkReportFormat(withoutForClaude);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('section "## For Claude"');
    // Issues and Session Impressions are still present
    expect(result.missing).not.toContain('section "## Issues"');
  });
});
