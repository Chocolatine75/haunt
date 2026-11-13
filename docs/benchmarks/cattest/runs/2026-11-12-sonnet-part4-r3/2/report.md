---
haunt: true
target: http://localhost:4102/
date: 2026-11-12
areas_tested: 2
issues:
  total: 1
  critical: 0
  major: 1
  minor: 0
signals:
  total: 15
  major: 15
  minor: 0
top_fix: "Trap focus in the lightbox, make the thumbnails real buttons, and make the background inert."
---

# Haunt Report — http://localhost:4102/
2026-11-12 · 2 areas · 1 issues

## Issues

### 1. [MAJOR] Keyboard focus is not contained by the open lightbox: after tabbing 32 times from opening, focus is not back on Close lightbox, so it escapes to the page behind (and/or thumbnail strip 'Jump to' items are divs not reachable by Tab).
- **Page:** `http://localhost:4102/`
- **Fix:** Trap focus in the lightbox, make the thumbnails real buttons, and make the background inert.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/b406365a-6c23-40fe-9c0e-5b0c4b3d6543/issue-1` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] GET /seed/lion1/400/300 has had no answer for 18.4 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/elephant2/400/300 has had no answer for 18.4 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/cheetah3/400/300 has had no answer for 18.4 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/flamingo4/400/300 has had no answer for 18.4 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/leopard5/400/300 has had no answer for 18.4 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/zebra6/400/300 has had no answer for 18.4 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/hippo7/400/300 has had no answer for 18.4 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/giraffe8/400/300 has had no answer for 18.4 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/crane9/400/300 has had no answer for 18.4 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/buffalo10/400/300 has had no answer for 18.4 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/rhino11/400/300 has had no answer for 18.4 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/wilddog12/400/300 has had no answer for 18.4 s — `http://localhost:4102/` (steps 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 10 times)
- [MAJOR] GET /seed/elephant2/1200/800 has had no answer for 14.1 s — `http://localhost:4102/` (step 1)
- [MAJOR] GET /seed/hippo7/1200/800 has had no answer for 14.0 s — `http://localhost:4102/` (step 10)
- [MAJOR] GET /seed/lion1/1200/800 has had no answer for 11.5 s — `http://localhost:4102/` (step 26)

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 18 of 51 controls exercised
- 7 test cases: 6 passed, 1 failed, 0 not run

Never exercised:
- button "Jump to Elephant Herd Crossing" — `/`
- button "Jump to Cheetah in Full Stride" — `/`
- button "Jump to Flamingo Reflections" — `/`
- button "Jump to Leopard's Vigil" — `/`
- button "Jump to Zebra Migration" — `/`
- button "Jump to Giraffe Silhouette" — `/`
- button "Jump to Crowned Crane Dance" — `/`
- button "Jump to Buffalo Standoff" — `/`
- button "Jump to Rhino Mother and Calf" — `/`
- button "Jump to Wild Dog Pack at Rest" — `/`
- generic "Lioness at Dawn — Serengeti National Park, Tanzania" — `/`
- generic "Lioness at Dawn Elephant Herd Crossing Cheetah in Full Stride Flamingo Reflections Leopard's Vigil Zebra Migration Hi..." — `/`
- generic "Giraffe Silhouette — Tsavo East, Kenya" — `/`
- generic "" — `/`
- generic "Hippo at Dusk" — `/`
- generic "Hippo at Dusk Okavango Delta, Botswana A massive hippo surfaces in the lilac waters as the last light paints the delt..." — `/`
- generic "" — `/`
- generic "Cheetah in Full Stride — Masai Mara, Kenya" — `/`
- generic "Flamingo Reflections — Lake Nakuru, Kenya" — `/`
- generic "Flamingo Reflections" — `/`
- generic "Leopard's Vigil — Ngorongoro Crater, Tanzania" — `/`
- generic "Leopard's Vigil" — `/`
- generic "Zebra Migration — Serengeti National Park, Tanzania" — `/`
- generic "Zebra Migration" — `/`
- generic "Giraffe Silhouette" — `/`
- generic "Crowned Crane Dance — Queen Elizabeth National Park, Uganda" — `/`
- generic "Crowned Crane Dance" — `/`
- generic "Buffalo Standoff — Kruger National Park, South Africa" — `/`
- generic "Buffalo Standoff" — `/`
- generic "Rhino Mother and Calf — Ol Pejeta Conservancy, Kenya" — `/`
- generic "Rhino Mother and Calf" — `/`
- generic "Wild Dog Pack at Rest — Selous Game Reserve, Tanzania" — `/`
- generic "Wild Dog Pack at Rest" — `/`

## Session Impressions

**/:** "Lightbox does not keep keyboard focus inside it; Close did nothing on first click in two attempts. All picsum.photos images fail or hang, so cards and thumbnails show only alt text. Only 9 of 48 controls exercised."
**/:** "engine sweep"

## Top Fix

Trap focus in the lightbox, make the thumbnails real buttons, and make the background inert.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4102/` — Trap focus in the lightbox, make the thumbnails real buttons, and make the background inert.. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4102/` again to verify.