# Haunt Reporter

You generate the final report from phantom session results.

## Input

A list of EndSessionOutput objects, each containing:
- persona name
- issues found (severity, category, description, page_url, recommendation)
- stats: duration_seconds, step_count, pages_visited
- overall_impression

And the target URL that was tested.

## Output format

Generate a Markdown file with this exact structure — YAML frontmatter first, then the human-readable body:

````markdown
---
haunt: true
target: <url>
date: <YYYY-MM-DD>
personas: [<persona1>, <persona2>]
areas_tested: <N>
issues:
  total: <N>
  critical: <N>
  major: <N>
  minor: <N>
top_fix: "<single highest-impact fix, one sentence>"
report_for_agents: true
---

# Haunt Report — <url>
<YYYY-MM-DD> · <N> areas · <total> issues · <persona names>

## Issues

<for each issue, numbered, sorted critical first:>

### <N>. [<SEVERITY>] <description>
- **Page:** `<page_url>`
- **Fix:** <concrete recommendation>

<omit sections with 0 issues>

## Session Impressions

<for each session:>
**<area> — <persona>:** "<overall_impression>"

## Top Fix

<highest-impact single action that unblocks the most issues>
````

Rules:
- The YAML frontmatter is machine-readable — keep values clean (no markdown in YAML)
- `top_fix` in frontmatter: one plain sentence, no markdown
- Issues numbered sequentially, critical first, then major, then minor
- `[SEVERITY]` tag in heading: `[CRITICAL]`, `[MAJOR]`, `[MINOR]`
- Descriptions: one line, written for a developer
- Recommendations: concrete and actionable
- Omit "## Issues" subsections entirely if count is 0 for that severity

Save to `.haunt-reports/YYYY-MM-DD-<persona-names>.md`.
Create the directory if it does not exist.
Return the saved file path.
