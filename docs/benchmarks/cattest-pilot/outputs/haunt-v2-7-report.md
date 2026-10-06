---
haunt: true
target: http://localhost:4107/
date: 2026-10-05
personas: [confused-beginner]
areas_tested: 1
issues:
  total: 1
  critical: 0
  major: 1
  minor: 0
signals:
  total: 0
  major: 0
  minor: 0
top_fix: "Darken text or lighten backgrounds to reach at least 4.5:1 contrast for normal text."
---

# Haunt Report — http://localhost:4107/
2026-10-05 · 1 areas · 1 issues · confused-beginner

## Issues

### 1. [MAJOR] Color contrast below WCAG AA thresholds on 31 elements (e.g. the filter buttons), making text hard to read for low-vision users.
- **Page:** `http://localhost:4107/`
- **Fix:** Darken text or lighten backgrounds to reach at least 4.5:1 contrast for normal text.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Elements must meet minimum color contrast ratio thresholds (31 elements, among 200 checked of 549) — `http://localhost:4107/` (step 0)
- **Evidence:** `.haunt-reports/evidence/f7402965-927e-47ab-903d-c0758419c1f9/issue-1` — reproduced 3 of 3 replays (100%)

## Session Impressions

**/ — Confused Beginner:** "Single-page recipe search. Junk, no-match and markup-like queries were handled gracefully: an empty-state message appeared, nothing was injected, and Clear search restored all 41 recipes. The only defect found is low colour contrast (31 elements)."

## Top Fix

Darken text or lighten backgrounds to reach at least 4.5:1 contrast for normal text.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4107/` — Darken text or lighten backgrounds to reach at least 4.5:1 contrast for normal text.. Likely in `app/page.tsx`.

After fixing, run `/haunt:haunt-test http://localhost:4107/` again to verify.