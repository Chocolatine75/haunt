---
haunt: true
target: http://localhost:4107/
date: 2026-10-05
areas_tested: 2
issues:
  total: 2
  critical: 0
  major: 2
  minor: 0
signals:
  total: 0
  major: 0
  minor: 0
top_fix: "Match only against titles when Titles Only is active."
---

# Haunt Report — http://localhost:4107/
2026-10-05 · 2 areas · 2 issues

## Issues

### 1. [MAJOR] Titles Only scope does not restrict matching to titles: with 'chicken' and Titles Only, Coq au Vin (no 'chicken' in title) still appears; results still show 8 and the summary reads 'Found in: 7 titles, 8 descriptions'. Only ingredient matching was removed.
- **Page:** `http://localhost:4107/`
- **Fix:** Match only against titles when Titles Only is active.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/5198080e-7a8c-4a33-b387-0bacc9e31444/issue-1` — reproduced 3 of 3 replays (100%)

### 2. [MAJOR] Color contrast violations (31 elements) flagged by axe on the home page.
- **Page:** `http://localhost:4107/`
- **Fix:** Raise text contrast to at least 4.5:1.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Elements must meet minimum color contrast ratio thresholds (31 elements, among 200 checked of 549) — `http://localhost:4107/` (step 0, 2 times)
- **Evidence:** `.haunt-reports/evidence/5198080e-7a8c-4a33-b387-0bacc9e31444/issue-3` — reproduced 3 of 3 replays (100%)

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 8 of 17 controls exercised
- 7 test cases: 3 passed, 4 failed, 0 not run

Never exercised:
- option "Chicken Parmesan recipe" — `/`
- option "chicken breast ingredient" — `/`
- option "Chicken Tacos al Pastor recipe" — `/`
- option "chicken thighs ingredient" — `/`
- option "Green Curry with Chicken recipe" — `/`
- option "Thai Basil Chicken Stir-Fry recipe" — `/`
- option "ground chicken ingredient" — `/`
- option "Butter Chicken recipe" — `/`
- generic "Chicken Parmesan" — `/`

## Session Impressions

**/:** "Titles Only filter still matches on descriptions (searching 'chicken' shows Coq au Vin). Home page has 31 color-contrast violations. Basic search, Ingredients Only, case-insensitive search and clearing behave correctly."
**/:** "Color-contrast violation (31 elements) confirmed. Sorting by prep time and difficulty works and persists across searches. Keyboard operation of search and filters works; Titles Only button exposes no pressed state (not confirmed on replay)."

## Top Fix

Match only against titles when Titles Only is active.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4107/` — Match only against titles when Titles Only is active.. Likely in `app/page.tsx`.
2. [MAJOR] `http://localhost:4107/` — Raise text contrast to at least 4.5:1.. Likely in `app/page.tsx`.

After fixing, run `/haunt:haunt-test http://localhost:4107/` again to verify.