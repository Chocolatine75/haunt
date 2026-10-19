---
haunt: true
target: http://localhost:4107/
date: 2026-10-06
areas_tested: 1
issues:
  total: 1
  critical: 0
  major: 1
  minor: 0
signals:
  total: 1
  major: 1
  minor: 0
top_fix: "Restrict matching to titles when Titles Only is active."
---

# Haunt Report — http://localhost:4107/
2026-10-06 · 1 areas · 1 issues

## Issues

### 1. [MAJOR] Titles Only scope is ignored: with Titles Only active and 'chicken' searched, Coq au Vin (title has no 'chicken', only description) is still listed; count stays 8 ('7 titles, 8 descriptions').
- **Page:** `http://localhost:4107/`
- **Fix:** Restrict matching to titles when Titles Only is active.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/1cc6216e-e211-4e47-aa87-8e4208cda12e/issue-1` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] Elements must meet minimum color contrast ratio thresholds (31 elements, among 200 checked of 549) — `http://localhost:4107/` (step 0)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

Checks that failed, and that no issue was filed for:
- "ingredients-only" on `/` — expected: With Ingredients Only on and 'garlic' searched, every result lists an ingredient containing 'garlic'.

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 8 of 17 controls exercised
- 11 test cases: 4 passed, 2 failed, 5 not run

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

**/:** "The Titles Only scope is ignored: with it on and 'chicken' searched, Coq au Vin still shows though its title lacks 'chicken'. A serious color-contrast violation was detected (31 elements). Other scopes, no-results, whitespace, case, clear and prep-time sort behaved correctly. Difficulty sort order was not checked."

## Top Fix

Restrict matching to titles when Titles Only is active.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4107/` — Restrict matching to titles when Titles Only is active.. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4107/` again to verify.