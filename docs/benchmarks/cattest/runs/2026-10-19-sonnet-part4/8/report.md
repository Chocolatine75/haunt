---
haunt: true
target: http://localhost:4108/
date: 2026-10-19
areas_tested: 2
issues:
  total: 1
  critical: 0
  major: 1
  minor: 0
signals:
  total: 25
  major: 4
  minor: 21
top_fix: "Make the scroll region focusable (tabindex=0) and render list items as buttons."
---

# Haunt Report — http://localhost:4108/
2026-10-19 · 2 areas · 1 issues

## Issues

### 1. [MAJOR] The brewery list sidebar is scrollable but cannot be reached by keyboard, and list items are non-focusable generic elements.
- **Page:** `http://localhost:4108/`
- **Fix:** Make the scroll region focusable (tabindex=0) and render list items as buttons.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Scrollable region must have keyboard access (1 element) — `http://localhost:4108/` (step 0)
- **Evidence:** `.haunt-reports/evidence/191f31e3-9c97-4d57-92f0-437a843d4773/issue-1` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] The button "🍺" is covered by the generic "🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 Leaflet © OpenStreetMap contributors": a click on it lands on what covers it — `http://localhost:4108/` (step 4)
- [MAJOR] The button "🍺" is covered by the generic "🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 Rogue Ales 🥾 Near: Yaquina Head Trail Style: Experimental brews ★★★★☆ 4.3/5 🕐 S...": a click on it lands on what covers it — `http://localhost:4108/` (step 5)
- [MAJOR] The button "🍺" is covered by the generic "🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 pFriem Family Brewers 🥾 Near: Eagle Creek Trail Style: Belgian-inspired ales ★★★...": a click on it lands on what covers it — `http://localhost:4108/` (step 7)
- [MAJOR] The button "Zoom in" is covered by the button "Toggle brewery list": a click on it lands on what covers it — `http://localhost:4108/` (step 11)
- [MINOR] The button "Toggle brewery list" and the button "Zoom in" overlap — `http://localhost:4108/` (step 11)
- [MINOR] GET /6/10/24.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/11/21.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/10/22.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/12/22.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/9/24.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/9/21.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/11/22.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/12/24.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/11/23.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/8/21.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/9/23.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/10/21.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/12/21.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/9/22.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/10/23.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/8/24.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/8/23.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/8/22.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/12/23.png answered 429 — `http://localhost:4108/` (step 0)
- [MINOR] GET /6/11/24.png answered 429 — `http://localhost:4108/` (step 0)

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 8 of 29 controls exercised
- 3 test cases: 3 passed, 0 failed, 0 not run

Never exercised:
- button "Close sidebar" — `/`
- generic "" — `/`
- generic "🍺 Deschutes Brewery Bend, OR" — `/`
- generic "🍺 Rogue Ales Newport, OR" — `/`
- generic "🍺 Elysian Brewing Seattle, WA" — `/`
- generic "🍺 10 Barrel Brewing Bend, OR" — `/`
- generic "🍺 Ninkasi Brewing Eugene, OR" — `/`
- generic "🍺 Skookum Brewery Arlington, WA" — `/`
- generic "🍺 Double Mountain Brewery Hood River, OR" — `/`
- generic "🍺 Pelican Brewing Pacific City, OR" — `/`
- generic "🍺 Aslan Brewing Bellingham, WA" — `/`
- button "Toggle brewery list" — `/`
- generic "🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 🍺 Leaflet © OpenStreetMap contributors" — `/`
- link "Leaflet" — `/`
- link "OpenStreetMap" — `/`
- generic "🍺" — `/`
- link "📍 Get Directions" — `/`
- generic "Rogue Ales 🥾 Near: Yaquina Head Trail Style: Experimental brews ★★★★☆ 4.3/5 🕐 Sun-Thu 11am-9pm, Fri-Sat 11am-10pm �..." — `/`
- generic "Rogue Ales" — `/`
- generic "☰" — `/`
- generic "Loading map tiles..." — `/`

## Session Impressions

**/:** "Map and brewery list work: list items and markers open the right popup, Close popup, View All and zoom work. One confirmed issue: the scrollable brewery list sidebar can't be reached by keyboard. Escape does not close the popup (not filed). Mobile layout not checked."
**/:** "engine sweep"

## Top Fix

Make the scroll region focusable (tabindex=0) and render list items as buttons.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4108/` — Make the scroll region focusable (tabindex=0) and render list items as buttons.. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4108/` again to verify.