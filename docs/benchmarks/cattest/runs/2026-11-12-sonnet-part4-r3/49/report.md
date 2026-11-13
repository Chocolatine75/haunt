---
haunt: true
target: http://localhost:4149/
date: 2026-11-13
areas_tested: 2
issues:
  total: 2
  critical: 0
  major: 1
  minor: 1
signals:
  total: 0
  major: 0
  minor: 0
top_fix: "Raise text contrast to 4.5:1"
---

# Haunt Report — http://localhost:4149/
2026-11-13 · 2 areas · 2 issues

## Issues

### 1. [MAJOR] Color contrast violations (3 elements)
- **Page:** `http://localhost:4149/`
- **Fix:** Raise text contrast to 4.5:1
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Elements must meet minimum color contrast ratio thresholds (3 elements) — `http://localhost:4149/` (step 0)
- **Evidence:** `.haunt-reports/evidence/0b4be974-fb5c-47f1-a92e-d8675720b3a6/issue-2` — reproduced 3 of 3 replays (100%)

### 2. [MINOR] Pressing ArrowRight once on the hero slider (value 50) jumps it to 72 instead of a small step
- **Page:** `http://localhost:4149/`
- **Fix:** Use a small keyboard step (1-10)
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/0b4be974-fb5c-47f1-a92e-d8675720b3a6/issue-1` — reproduced 3 of 3 replays (100%)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

Checks that failed, and that no issue was filed for:
- "drag" on `/` — expected: ArrowLeft lowers Front Yard slider value — the page showed: "\n                        \n                    "

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 10 of 19 controls exercised
- 5 test cases: 3 passed, 2 failed, 0 not run

Never exercised:
- link "How It Works" — `/`
- link "Book Now" — `/`
- generic "AFTER BEFORE" — `/`
- slider "Commercial Property comparison slider" — `/`
- slider "Patio and Garden comparison slider" — `/`
- link "Home" — `/`
- generic "Green Scape Pro Gallery How It Works Book Now" — `/`
- generic "Green Scape Pro" — `/`
- generic "Scape" — `/`

## Session Impressions

**/:** "Hero slider keyboard step is wrong (ArrowRight moved 50 to 72, vs 2 on the Front Yard slider); color-contrast violations on 3 elements. Gallery link, form validation and valid submission worked."
**/:** "engine sweep"

## Top Fix

Raise text contrast to 4.5:1

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4149/` — Raise text contrast to 4.5:1. Likely in `app/page.tsx`.
2. [MINOR] `http://localhost:4149/` — Use a small keyboard step (1-10). Likely in `app/page.tsx`.

After fixing, run `/haunt:haunt-test http://localhost:4149/` again to verify.