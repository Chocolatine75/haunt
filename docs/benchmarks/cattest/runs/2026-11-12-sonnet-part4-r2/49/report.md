---
haunt: true
target: http://localhost:4149/
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
top_fix: "Use a small keyboard step (1-5) and keep aria value in sync with the handle position."
---

# Haunt Report — http://localhost:4149/
2026-11-12 · 2 areas · 1 issues

## Issues

### 1. [MAJOR] Pressing ArrowRight once on the hero slider (aria value 50) jumps it to 72 instead of a small step; the handle also rendered off-center at initial 50.
- **Page:** `http://localhost:4149/`
- **Fix:** Use a small keyboard step (1-5) and keep aria value in sync with the handle position.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/3c30ccb1-e325-47d7-9d23-046672669251/issue-1` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] Elements must meet minimum color contrast ratio thresholds (3 elements) — `http://localhost:4149/` (step 0)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MINOR] Gallery sliders ignore the End key (value stays 27 after End); keyboard steps are inconsistent (hero +22, gallery +2). (`http://localhost:4149/`)
  - Expected: End sets the slider to its max, Home to its min
  - Seen: End did nothing, value stayed 27
  - Steps: `.haunt-reports/evidence/3c30ccb1-e325-47d7-9d23-046672669251/issue-2`

Checks that failed, and that no issue was filed for:
- "form-empty" on `/` — expected: Empty submit shows validation

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 9 of 19 controls exercised
- 4 test cases: 2 passed, 2 failed, 0 not run

Never exercised:
- link "How It Works" — `/`
- link "Book Now" — `/`
- generic "AFTER BEFORE" — `/`
- slider "Front Yard comparison slider" — `/`
- slider "Commercial Property comparison slider" — `/`
- slider "Patio and Garden comparison slider" — `/`
- link "Home" — `/`
- generic "Green Scape Pro Gallery How It Works Book Now" — `/`
- generic "Green Scape Pro" — `/`
- generic "Scape" — `/`

## Session Impressions

**/:** "Slider keyboard handling is wrong (one ArrowRight jumped 50 to 72, handle off-centre at start, gallery sliders ignore End and use different steps). Booking form validates and confirms. Colour-contrast violations flagged. 9 of 26 controls exercised."
**/:** "engine sweep"

## Top Fix

Use a small keyboard step (1-5) and keep aria value in sync with the handle position.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4149/` — Use a small keyboard step (1-5) and keep aria value in sync with the handle position.. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4149/` again to verify.