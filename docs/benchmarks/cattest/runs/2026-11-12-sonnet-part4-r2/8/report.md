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
  total: 4
  major: 3
  minor: 1
top_fix: "Make items buttons/links with tabindex and make the scroll region focusable"
---

# Haunt Report — http://localhost:4108/
2026-11-12 · 2 areas · 1 issues

## Issues

### 1. [MAJOR] Sidebar brewery list is a scrollable region not reachable by keyboard; list items are plain divs, not buttons/links, so keyboard users cannot select a brewery
- **Page:** `http://localhost:4108/`
- **Fix:** Make items buttons/links with tabindex and make the scroll region focusable
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Scrollable region must have keyboard access (1 element) — `http://localhost:4108/` (step 0)
- **Evidence:** `.haunt-reports/evidence/1246f260-b8ee-438e-9a80-f5254d857710/issue-1` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] The button "🍺" is covered by the generic "🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 Leaflet © OpenStreetMap contributors": a click on it lands on what covers it — `http://localhost:4108/` (step 3)
- [MAJOR] The button "🍺" is covered by the generic "🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 Double Mountain Brewery 🥾 Near: Tom McCall Point Style: Wood-fired pizza & ales ...": a click on it lands on what covers it — `http://localhost:4108/` (step 7)
- [MAJOR] The button "Zoom in" is covered by the button "Toggle brewery list": a click on it lands on what covers it — `http://localhost:4108/` (step 11)
- [MINOR] The button "Toggle brewery list" and the button "Zoom in" overlap — `http://localhost:4108/` (step 11)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MINOR] Escape does not close the open brewery popup (`http://localhost:4108/`)
  - Expected: Escape closes the popup
  - Seen: Popup stays open
  - Steps: `.haunt-reports/evidence/1246f260-b8ee-438e-9a80-f5254d857710/issue-2`
- [MINOR] Bale Breaker rating 4.7/5 is shown with 4.5 stars (rounded down) (`http://localhost:4108/`)
  - Expected: Stars reflect 4.7 (about 5)
  - Seen: Shows 4 and a half stars
  - Steps: `.haunt-reports/evidence/1246f260-b8ee-438e-9a80-f5254d857710/issue-3`

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 8 of 27 controls exercised
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
- generic "🍺 Aslan Brewing Bellingham, WA" — `/`
- button "Toggle brewery list" — `/`
- generic "🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 Leaflet © OpenStreetMap contributors" — `/`
- button "🍺" — `/`
- link "Leaflet" — `/`
- link "OpenStreetMap" — `/`
- generic "🍺" — `/`
- link "📍 Get Directions" — `/`
- generic "☰" — `/`
- generic "Loading map tiles..." — `/`

## Session Impressions

**/:** "Map, sidebar, popups, zoom and View All work. Sidebar list is not keyboard-reachable and its items are plain divs. Escape does not close the popup; Bale Breaker's 4.7/5 rating shows 4.5 stars. Only 8 of 46 controls exercised."
**/:** "engine sweep"

## Top Fix

Make items buttons/links with tabindex and make the scroll region focusable

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4108/` — Make items buttons/links with tabindex and make the scroll region focusable. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4108/` again to verify.