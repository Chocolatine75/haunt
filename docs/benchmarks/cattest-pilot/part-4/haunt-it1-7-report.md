---
haunt: true
target: http://localhost:4107/
date: 2026-10-06
areas_tested: 1
issues:
  total: 2
  critical: 0
  major: 2
  minor: 0
signals:
  total: 0
  major: 0
  minor: 0
top_fix: "Restrict matching to titles when Titles Only is active."
---

# Haunt Report — http://localhost:4107/
2026-10-06 · 1 areas · 2 issues

## Issues

### 1. [MAJOR] Titles Only scope with query 'chicken' still matches on descriptions/ingredients: Coq au Vin (no 'chicken' in title) is shown and count reads 8 with 'Found in: 7 titles, 8 descriptions'.
- **Page:** `http://localhost:4107/`
- **Fix:** Restrict matching to titles when Titles Only is active.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/b0cca5ae-c64e-4423-87a0-7fdf89866012/issue-1` — reproduced 3 of 3 replays (100%)

### 2. [MAJOR] Color contrast below WCAG AA on 31 elements (e.g. the scope filter buttons / header text).
- **Page:** `http://localhost:4107/`
- **Fix:** Raise text/background contrast to at least 4.5:1.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Elements must meet minimum color contrast ratio thresholds (31 elements, among 200 checked of 549) — `http://localhost:4107/` (step 0)
- **Evidence:** `.haunt-reports/evidence/b0cca5ae-c64e-4423-87a0-7fdf89866012/issue-2` — reproduced 3 of 3 replays (100%)

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 8 of 17 controls exercised
- 14 test cases: 5 passed, 3 failed, 6 not run

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

**/:** "Titles Only scope is broken: searching "chicken" still shows Coq au Vin, which has no "chicken" in its title. Color contrast fails WCAG AA on 31 elements. Cuisine, Cooking Method, Ingredients scopes, no-results, odd input, special characters, Clear search and Sort by Prep Time behaved correctly. Not played: all-search, scope-switch-keeps-query, keyboard-search, sort-options (Difficulty), count-agree."

## Top Fix

Restrict matching to titles when Titles Only is active.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4107/` — Restrict matching to titles when Titles Only is active.. Likely in `app/page.tsx`.
2. [MAJOR] `http://localhost:4107/` — Raise text/background contrast to at least 4.5:1.. Likely in `app/page.tsx`.

After fixing, run `/haunt:haunt-test http://localhost:4107/` again to verify.