---
haunt: true
target: http://localhost:4108/
date: 2026-11-12
areas_tested: 2
issues:
  total: 1
  critical: 0
  major: 1
  minor: 0
signals:
  total: 3
  major: 2
  minor: 1
top_fix: "Add tabindex=0 and a role/label to the scroll container."
---

# Haunt Report — http://localhost:4108/
2026-11-12 · 2 areas · 1 issues

## Issues

### 1. [MAJOR] The scrollable brewery list sidebar cannot be reached by keyboard (axe: scrollable-region-focusable).
- **Page:** `http://localhost:4108/`
- **Fix:** Add tabindex=0 and a role/label to the scroll container.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Scrollable region must have keyboard access (1 element) — `http://localhost:4108/` (step 0)
- **Evidence:** `.haunt-reports/evidence/8b334318-acbb-4f92-944a-d12b2b20a539/issue-1` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] The button "🍺" is covered by the generic "🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 Leaflet © OpenStreetMap contributors": a click on it lands on what covers it — `http://localhost:4108/` (step 5)
- [MAJOR] The button "Zoom in" is covered by the button "Toggle brewery list": a click on it lands on what covers it — `http://localhost:4108/` (step 12)
- [MINOR] The button "Toggle brewery list" and the button "Zoom in" overlap — `http://localhost:4108/` (step 12)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MAJOR] Brewery list items are plain generic elements (no button role, no tabindex), so keyboard users cannot select a brewery from the list. (`http://localhost:4108/`)
  - Expected: List items are focusable buttons/links that open the brewery popup via Enter
  - Seen: Items are generic divs with no role or tabindex, only usable with a pointer
  - Steps: `.haunt-reports/evidence/8b334318-acbb-4f92-944a-d12b2b20a539/issue-2`
- [MINOR] Popup title 'Double Mountain Brewery' runs right up against the close X button. (`http://localhost:4108/`)
  - Expected: Title has clear spacing from the close button
  - Seen: Title text nearly touches the X
  - Steps: `.haunt-reports/evidence/8b334318-acbb-4f92-944a-d12b2b20a539/issue-3`

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 6 of 27 controls exercised
- 3 test cases: 3 passed, 0 failed, 0 not run

Never exercised:
- button "Close sidebar" — `/`
- generic "" — `/`
- generic "🍺 pFriem Family Brewers Hood River, OR" — `/`
- generic "🍺 Deschutes Brewery Bend, OR" — `/`
- generic "🍺 Rogue Ales Newport, OR" — `/`
- generic "🍺 Elysian Brewing Seattle, WA" — `/`
- generic "🍺 10 Barrel Brewing Bend, OR" — `/`
- generic "🍺 Ninkasi Brewing Eugene, OR" — `/`
- generic "🍺 Skookum Brewery Arlington, WA" — `/`
- generic "🍺 Pelican Brewing Pacific City, OR" — `/`
- generic "🍺 Aslan Brewing Bellingham, WA" — `/`
- button "Toggle brewery list" — `/`
- generic "🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 Leaflet © OpenStreetMap contributors" — `/`
- button "🍺" — `/`
- button "Zoom in" — `/`
- link "Leaflet" — `/`
- link "OpenStreetMap" — `/`
- generic "🍺" — `/`
- link "📍 Get Directions" — `/`
- generic "☰" — `/`
- generic "Loading map tiles..." — `/`

## Session Impressions

**/:** "The map and list work as expected. Three issues were filed: the scrollable sidebar can't be reached by keyboard, list items can't be opened by keyboard, and a popup title runs up against its close button. Only 7 of 44 controls were exercised."
**/:** "engine sweep"

## Top Fix

Add tabindex=0 and a role/label to the scroll container.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4108/` — Add tabindex=0 and a role/label to the scroll container.. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4108/` again to verify.