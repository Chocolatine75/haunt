---
haunt: true
target: http://localhost:4141/
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
top_fix: "Wire the button to a pre-order flow or show confirmation."
---

# Haunt Report — http://localhost:4141/
2026-11-12 · 2 areas · 2 issues

## Issues

### 1. [MAJOR] Pre-Order Now button does nothing when clicked: no feedback, no navigation, no cart/dialog.
- **Page:** `http://localhost:4141/`
- **Fix:** Wire the button to a pre-order flow or show confirmation.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/49c6ddb6-b252-4e70-81f9-88e09a2593e9/issue-1` — reproduced 3 of 3 replays (100%)

### 2. [MINOR] Color contrast failures (axe color-contrast, 2 elements) on the landing page.
- **Page:** `http://localhost:4141/`
- **Fix:** Raise text contrast to 4.5:1.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Elements must meet minimum color contrast ratio thresholds (2 elements) — `http://localhost:4141/` (step 0)
- **Evidence:** `.haunt-reports/evidence/49c6ddb6-b252-4e70-81f9-88e09a2593e9/issue-2` — reproduced 3 of 3 replays (100%)

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 5 of 11 controls exercised
- 2 test cases: 1 passed, 1 failed, 0 not run

Never exercised:
- link "The Highlands" — `/`
- link "The Harvest" — `/`
- link "The Craft" — `/`
- link "The Roast" — `/`
- link "Your Cup" — `/`
- generic "☕ Brewing your experience..." — `/`

## Session Impressions

**/:** "The Pre-Order Now button is dead (no feedback, navigation or dialog), and 2 elements fail color contrast. Nav links, header Pre-Order link and Back to top work."
**/:** "engine sweep"

## Top Fix

Wire the button to a pre-order flow or show confirmation.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4141/` — Wire the button to a pre-order flow or show confirmation.. Likely in `app/page.tsx`.
2. [MINOR] `http://localhost:4141/` — Raise text contrast to 4.5:1.. Likely in `app/page.tsx`.

After fixing, run `/haunt:haunt-test http://localhost:4141/` again to verify.