---
haunt: true
target: http://localhost:4102/
date: 2026-11-12
areas_tested: 2
issues:
  total: 0
  critical: 0
  major: 0
  minor: 0
signals:
  total: 15
  major: 15
  minor: 0
top_fix: ""
---

# Haunt Report — http://localhost:4102/
2026-11-12 · 2 areas · 0 issues

## Issues

_No issues found._

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] GET /seed/lion1/400/300 has had no answer for 18.2 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/elephant2/400/300 has had no answer for 18.2 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/cheetah3/400/300 has had no answer for 18.2 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/flamingo4/400/300 has had no answer for 18.2 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/leopard5/400/300 has had no answer for 18.2 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/zebra6/400/300 has had no answer for 18.2 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/hippo7/400/300 has had no answer for 18.2 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/giraffe8/400/300 has had no answer for 18.2 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/crane9/400/300 has had no answer for 18.2 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/buffalo10/400/300 has had no answer for 18.2 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/rhino11/400/300 has had no answer for 18.2 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/wilddog12/400/300 has had no answer for 18.2 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/elephant2/1200/800 has had no answer for 14.2 s — `http://localhost:4102/` (step 1)
- [MAJOR] GET /seed/wilddog12/1200/800 has had no answer for 13.0 s — `http://localhost:4102/` (step 6)
- [MAJOR] GET /seed/lion1/1200/800 has had no answer for 12.8 s — `http://localhost:4102/` (step 13)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

Checks that failed, and that no issue was filed for:
- "esc" on `/` — expected: Escape closes lightbox
- "trap" on `/` — expected: Tab keeps focus inside lightbox: after 40 tabs focus is on a lightbox control — the page showed: false

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 18 of 51 controls exercised
- 7 test cases: 5 passed, 2 failed, 0 not run

Never exercised:
- button "Jump to Elephant Herd Crossing" — `/`
- button "Jump to Cheetah in Full Stride" — `/`
- button "Jump to Flamingo Reflections" — `/`
- button "Jump to Leopard's Vigil" — `/`
- button "Jump to Zebra Migration" — `/`
- button "Jump to Hippo at Dusk" — `/`
- button "Jump to Giraffe Silhouette" — `/`
- button "Jump to Crowned Crane Dance" — `/`
- button "Jump to Rhino Mother and Calf" — `/`
- button "Jump to Wild Dog Pack at Rest" — `/`
- generic "Lioness at Dawn — Serengeti National Park, Tanzania" — `/`
- generic "Lioness at Dawn Elephant Herd Crossing Cheetah in Full Stride Flamingo Reflections Leopard's Vigil Zebra Migration Hi..." — `/`
- generic "Wild Dog Pack at Rest — Selous Game Reserve, Tanzania" — `/`
- generic "Elena Vasquez Wildlife Photography — East Africa" — `/`
- generic "" — `/`
- generic "Lioness at Dawn Serengeti National Park, Tanzania Captured during the golden hour as the pride prepared for their eve..." — `/`
- generic "" — `/`
- generic "Cheetah in Full Stride — Masai Mara, Kenya" — `/`
- generic "Flamingo Reflections — Lake Nakuru, Kenya" — `/`
- generic "Flamingo Reflections" — `/`
- generic "Leopard's Vigil — Ngorongoro Crater, Tanzania" — `/`
- generic "Leopard's Vigil" — `/`
- generic "Zebra Migration — Serengeti National Park, Tanzania" — `/`
- generic "Zebra Migration" — `/`
- generic "Hippo at Dusk — Okavango Delta, Botswana" — `/`
- generic "Hippo at Dusk" — `/`
- generic "Giraffe Silhouette — Tsavo East, Kenya" — `/`
- generic "Giraffe Silhouette" — `/`
- generic "Crowned Crane Dance — Queen Elizabeth National Park, Uganda" — `/`
- generic "Crowned Crane Dance" — `/`
- generic "Rhino Mother and Calf — Ol Pejeta Conservancy, Kenya" — `/`
- generic "Rhino Mother and Calf" — `/`
- generic "Wild Dog Pack at Rest" — `/`

## Session Impressions

**/:** "No confirmed issues in the lightbox (Next, Previous, jump, ArrowRight, Escape work). Close button not verified; images hosted externally never loaded in sandbox; zoom hides main image; page scroll left at bottom after closing lightbox."
**/:** "engine sweep"

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

_No issues found._

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4102/` again to verify.