---
haunt: true
target: http://localhost:4107/
date: 2026-10-19
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
top_fix: "Make Titles Only restrict matching to titles."
---

# Haunt Report — http://localhost:4107/
2026-10-19 · 2 areas · 2 issues

## Issues

### 1. [MAJOR] With the Titles Only filter selected and query 'chicken', results still include Coq au Vin, whose title lacks 'chicken' (matched via description); header reads 'Found in: 7 titles, 8 descriptions', so the filter is not applied.
- **Page:** `http://localhost:4107/`
- **Fix:** Make Titles Only restrict matching to titles.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/701ad9dc-2739-4245-8cf0-7aa95f284247/issue-1` — reproduced 3 of 3 replays (100%)

### 2. [MINOR] Color contrast violations on 31 elements
- **Page:** `http://localhost:4107/`
- **Fix:** Raise contrast to 4.5:1
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Elements must meet minimum color contrast ratio thresholds (31 elements, among 200 checked of 549) — `http://localhost:4107/` (step 0)
- **Evidence:** `.haunt-reports/evidence/701ad9dc-2739-4245-8cf0-7aa95f284247/issue-2` — reproduced 3 of 3 replays (100%)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

Checks that failed, and that no issue was filed for:
- "ingr" on `/` — expected: Ingredients Only with 'garlic' count matches list
- "cuisine" on `/` — expected: Cuisine filter with 'thai' shows only Thai — the page showed: []
- "sort" on `/` — expected: Sorting changes order — the page showed: []

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 8 of 17 controls exercised
- 5 test cases: 2 passed, 3 failed, 0 not run

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

**/:** "Titles Only filter does not restrict matching to titles (Coq au Vin listed for 'chicken'); color contrast fails on 31 elements. Search, no-results, sorting, Ingredients Only and Cuisine filters behaved as expected; Cooking Method filter not exercised by the tester."
**/:** "engine sweep"

## Top Fix

Make Titles Only restrict matching to titles.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4107/` — Make Titles Only restrict matching to titles.. Likely in `app/page.tsx`.
2. [MINOR] `http://localhost:4107/` — Raise contrast to 4.5:1. Likely in `app/page.tsx`.

After fixing, run `/haunt:haunt-test http://localhost:4107/` again to verify.