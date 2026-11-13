---
haunt: true
target: http://localhost:4107/
date: 2026-11-12
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
top_fix: "Make the scope filters restrict matching and show a pressed state"
---

# Haunt Report — http://localhost:4107/
2026-11-12 · 2 areas · 2 issues

## Issues

### 1. [MAJOR] Titles Only filter button does nothing: with 'chicken' typed, results stay at 8 (including Coq au Vin, matched by description only) and the button shows no active state
- **Page:** `http://localhost:4107/`
- **Fix:** Make the scope filters restrict matching and show a pressed state
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/7f002c06-c5ec-4b6a-9da8-d25daeaa6154/issue-1` — reproduced 3 of 3 replays (100%)

### 2. [MINOR] Color contrast failures on 31 elements
- **Page:** `http://localhost:4107/`
- **Fix:** Raise contrast to WCAG AA
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Elements must meet minimum color contrast ratio thresholds (31 elements, among 200 checked of 549) — `http://localhost:4107/` (step 0)
- **Evidence:** `.haunt-reports/evidence/7f002c06-c5ec-4b6a-9da8-d25daeaa6154/issue-2` — reproduced 3 of 3 replays (100%)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

Checks that failed, and that no issue was filed for:
- "sort" on `/` — expected: sort by time ascending — the page showed: []

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 8 of 17 controls exercised
- 6 test cases: 4 passed, 2 failed, 0 not run

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

**/:** "The Titles Only filter does not restrict results to title matches. Searching "thai" with it on shows 5 recipes while the page reports only 2 title matches. "chicken" with it on still includes Coq au Vin, which matches by description only. Color-contrast failures on 31 elements. Search, Ingredients Only and Cuisine filters, the Relevance and Prep Time sorts, the empty state and the result count behaved correctly."
**/:** "engine sweep"

## Top Fix

Make the scope filters restrict matching and show a pressed state

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4107/` — Make the scope filters restrict matching and show a pressed state. Likely in `app/page.tsx`.
2. [MINOR] `http://localhost:4107/` — Raise contrast to WCAG AA. Likely in `app/page.tsx`.

After fixing, run `/haunt:haunt-test http://localhost:4107/` again to verify.