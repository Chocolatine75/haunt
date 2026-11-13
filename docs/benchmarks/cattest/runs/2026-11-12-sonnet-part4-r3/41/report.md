---
haunt: true
target: http://localhost:4141/
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
top_fix: "Wire the button to a checkout/order flow or confirmation."
---

# Haunt Report — http://localhost:4141/
2026-11-12 · 2 areas · 1 issues

## Issues

### 1. [MAJOR] Pre-Order Now — $24 button does nothing when clicked: no feedback, navigation, or state change.
- **Page:** `http://localhost:4141/`
- **Fix:** Wire the button to a checkout/order flow or confirmation.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/38bea53d-2943-40d2-ae67-54923ffd8e5e/issue-1` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] Elements must meet minimum color contrast ratio thresholds (2 elements) — `http://localhost:4141/` (step 0)

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

**/:** "The Pre-Order Now button is dead (no feedback or state change). Nav links worked. A serious color-contrast violation was flagged near the nav."
**/:** "engine sweep"

## Top Fix

Wire the button to a checkout/order flow or confirmation.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4141/` — Wire the button to a checkout/order flow or confirmation.. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4141/` again to verify.