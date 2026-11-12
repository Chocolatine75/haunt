---
haunt: true
target: http://localhost:4141/
date: 2026-10-19
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
top_fix: "Wire the button to an order flow or show feedback"
---

# Haunt Report — http://localhost:4141/
2026-10-19 · 2 areas · 1 issues

## Issues

### 1. [MAJOR] Pre-Order Now button does nothing when clicked: no confirmation, no navigation, no DOM change
- **Page:** `http://localhost:4141/`
- **Fix:** Wire the button to an order flow or show feedback
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/ed0eda8b-b543-4d5c-b6d4-c7452bb19e16/issue-1` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] Elements must meet minimum color contrast ratio thresholds (2 elements) — `http://localhost:4141/` (step 0)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MINOR] Loader text 'Brewing your experience...' remains faintly visible behind the hero after load (`http://localhost:4141/`)
  - Expected: Loader gone
  - Seen: Ghosted loader text overlaps hero subtitle
  - Steps: `.haunt-reports/evidence/ed0eda8b-b543-4d5c-b6d4-c7452bb19e16/issue-2`

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 4 of 11 controls exercised
- 4 test cases: 3 passed, 1 failed, 0 not run

Never exercised:
- link "Origins" — `/`
- link "The Highlands" — `/`
- link "The Harvest" — `/`
- link "The Craft" — `/`
- link "The Roast" — `/`
- link "Your Cup" — `/`
- generic "☕ Brewing your experience..." — `/`

## Session Impressions

**/:** "The Pre-Order Now button is dead; loader text may remain faintly visible behind the hero subtitle; color-contrast signal detected. Chapter nav links and Back to top work."
**/:** "engine sweep"

## Top Fix

Wire the button to an order flow or show feedback

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4141/` — Wire the button to an order flow or show feedback. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4141/` again to verify.