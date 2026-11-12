---
haunt: true
target: http://localhost:4149/
date: 2026-10-19
areas_tested: 2
issues:
  total: 1
  critical: 0
  major: 0
  minor: 1
signals:
  total: 0
  major: 0
  minor: 0
top_fix: "Darken the text colors to reach 4.5:1."
---

# Haunt Report — http://localhost:4149/
2026-10-19 · 2 areas · 1 issues

## Issues

### 1. [MINOR] Color contrast below WCAG AA on 3 elements (e.g. grey subtitle text)
- **Page:** `http://localhost:4149/`
- **Fix:** Darken the text colors to reach 4.5:1.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Elements must meet minimum color contrast ratio thresholds (3 elements) — `http://localhost:4149/` (step 0)
- **Evidence:** `.haunt-reports/evidence/e8d305a6-6715-4445-a517-273846c302c4/issue-1` — reproduced 3 of 3 replays (100%)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

Checks that failed, and that no issue was filed for:
- "slider-key" on `/` — expected: ArrowRight raises slider value above 50 — the page showed: "\n                    \n                        \n                        \n                    \n                "

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 11 of 19 controls exercised
- 4 test cases: 3 passed, 1 failed, 0 not run

Never exercised:
- link "How It Works" — `/`
- generic "AFTER BEFORE" — `/`
- slider "Commercial Property comparison slider" — `/`
- slider "Patio and Garden comparison slider" — `/`
- link "Home" — `/`
- generic "Green Scape Pro Gallery How It Works Book Now" — `/`
- generic "Green Scape Pro" — `/`
- generic "Scape" — `/`

## Session Impressions

**/:** "Low color contrast on 3 elements; booking form validation and confirmation work; sliders respond to keyboard."
**/:** "engine sweep"

## Top Fix

Darken the text colors to reach 4.5:1.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MINOR] `http://localhost:4149/` — Darken the text colors to reach 4.5:1.. Likely in `app/page.tsx`.

After fixing, run `/haunt:haunt-test http://localhost:4149/` again to verify.