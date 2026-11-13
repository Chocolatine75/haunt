---
haunt: true
target: http://localhost:4107/
date: 2026-11-12
areas_tested: 2
issues:
  total: 1
  critical: 0
  major: 1
  minor: 0
signals:
  total: 1
  major: 1
  minor: 0
top_fix: "Only match titles in Titles Only mode"
---

# Haunt Report — http://localhost:4107/
2026-11-12 · 2 areas · 1 issues

## Issues

### 1. [MAJOR] Titles Only mode still matches descriptions (footer says 'Found in: 7 titles, 8 descriptions') and shows Coq au Vin, whose title lacks 'chicken'
- **Page:** `http://localhost:4107/`
- **Fix:** Only match titles in Titles Only mode
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/ead154e0-45b4-414a-ac6a-e783d5d470ee/issue-2` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] Elements must meet minimum color contrast ratio thresholds (31 elements, among 200 checked of 549) — `http://localhost:4107/` (step 0)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

Checks that failed, and that no issue was filed for:
- "ingr" on `/` — expected: Ingredients Only 'garlic' count matches list

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

**/:** "Titles Only filter still matches descriptions and ingredients; other filters, sort and clear worked. Colour-contrast signal detected."
**/:** "engine sweep"

## Top Fix

Only match titles in Titles Only mode

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4107/` — Only match titles in Titles Only mode. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4107/` again to verify.