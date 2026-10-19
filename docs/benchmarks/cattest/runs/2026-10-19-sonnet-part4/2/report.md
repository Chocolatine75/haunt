---
haunt: true
target: http://localhost:4102/
date: 2026-10-19
areas_tested: 2
issues:
  total: 1
  critical: 0
  major: 1
  minor: 0
signals:
  total: 0
  major: 0
  minor: 0
top_fix: "Trap focus in the lightbox (inert background or Tab loop) and set aria-modal/role=dialog."
---

# Haunt Report — http://localhost:4102/
2026-10-19 · 2 areas · 1 issues

## Issues

### 1. [MAJOR] Lightbox does not trap focus: after opening an image and pressing Tab a few times, focus moves to the gallery cards behind the overlay (Hippo card shows focus ring, page scrolls behind) instead of staying on the lightbox controls.
- **Page:** `http://localhost:4102/`
- **Fix:** Trap focus in the lightbox (inert background or Tab loop) and set aria-modal/role=dialog.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/68933cae-b54f-4769-8066-1b1ab3f7e49a/issue-1` — reproduced 3 of 3 replays (100%)

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 18 of 53 controls exercised
- 8 test cases: 7 passed, 1 failed, 0 not run

Never exercised:
- button "Jump to Lioness at Dawn" — `/`
- button "Jump to Elephant Herd Crossing" — `/`
- button "Jump to Cheetah in Full Stride" — `/`
- button "Jump to Flamingo Reflections" — `/`
- button "Jump to Leopard's Vigil" — `/`
- button "Jump to Zebra Migration" — `/`
- button "Jump to Hippo at Dusk" — `/`
- button "Jump to Giraffe Silhouette" — `/`
- button "Jump to Buffalo Standoff" — `/`
- button "Jump to Rhino Mother and Calf" — `/`
- generic "Cheetah in Full Stride — Masai Mara, Kenya" — `/`
- generic "Lioness at Dawn Elephant Herd Crossing Cheetah in Full Stride Flamingo Reflections Leopard's Vigil Zebra Migration Hi..." — `/`
- generic "" — `/`
- generic "Cheetah in Full Stride Masai Mara, Kenya The fastest land animal reaches top speed in pursuit of a Thomson's gazelle." — `/`
- generic "Cheetah in Full Stride" — `/`
- generic "" — `/`
- generic "Lioness at Dawn — Serengeti National Park, Tanzania" — `/`
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
- generic "Buffalo Standoff — Kruger National Park, South Africa" — `/`
- generic "Buffalo Standoff" — `/`
- generic "Rhino Mother and Calf — Ol Pejeta Conservancy, Kenya" — `/`
- generic "Rhino Mother and Calf" — `/`
- generic "Wild Dog Pack at Rest — Selous Game Reserve, Tanzania" — `/`
- generic "Wild Dog Pack at Rest" — `/`

## Session Impressions

**/:** "One confirmed major accessibility issue: the lightbox does not trap focus. Next, Previous, wrap-around, Jump thumbnails, keyboard and Escape/Close worked. 8 of 47 controls exercised."
**/:** "engine sweep"

## Top Fix

Trap focus in the lightbox (inert background or Tab loop) and set aria-modal/role=dialog.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4102/` — Trap focus in the lightbox (inert background or Tab loop) and set aria-modal/role=dialog.. Likely in `app/page.tsx`.

After fixing, run `/haunt:haunt-test http://localhost:4102/` again to verify.

## Sandbox-Blocked Requests

These are not app bugs — the test sandbox blocked an attempt to reach an origin outside the target app, shown here for visibility into what the persona tried.

- GET https://picsum.photos/seed/elephant2/400/300 -> https://fastly.picsum.photos/id/687/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/400/300 -> https://fastly.picsum.photos/id/490/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/400/300 -> https://fastly.picsum.photos/id/305/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/400/300 -> https://fastly.picsum.photos/id/1/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/400/300 -> https://fastly.picsum.photos/id/608/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/400/300 -> https://fastly.picsum.photos/id/353/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/400/300 -> https://fastly.picsum.photos/id/815/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/400/300 -> https://fastly.picsum.photos/id/91/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/400/300 -> https://fastly.picsum.photos/id/131/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/400/300 -> https://fastly.picsum.photos/id/816/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/400/300 -> https://fastly.picsum.photos/id/610/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/1200/800 -> https://fastly.picsum.photos/id/687/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/1200/800 -> https://fastly.picsum.photos/id/490/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/1200/800 -> https://fastly.picsum.photos/id/353/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/1200/800 -> https://fastly.picsum.photos/id/1/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/1200/800 -> https://fastly.picsum.photos/id/500/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/1200/800 -> https://fastly.picsum.photos/id/1/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/1200/800 -> https://fastly.picsum.photos/id/500/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/1200/800 -> https://fastly.picsum.photos/id/490/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/1200/800 -> https://fastly.picsum.photos/id/490/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/400/300 -> https://fastly.picsum.photos/id/305/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/400/300 -> https://fastly.picsum.photos/id/610/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/400/300 -> https://fastly.picsum.photos/id/490/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/400/300 -> https://fastly.picsum.photos/id/353/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/400/300 -> https://fastly.picsum.photos/id/608/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/400/300 -> https://fastly.picsum.photos/id/1/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/400/300 -> https://fastly.picsum.photos/id/687/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/400/300 -> https://fastly.picsum.photos/id/816/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/400/300 -> https://fastly.picsum.photos/id/815/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/400/300 -> https://fastly.picsum.photos/id/91/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/400/300 -> https://fastly.picsum.photos/id/131/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/1200/800 -> https://fastly.picsum.photos/id/500/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/400/300 -> https://fastly.picsum.photos/id/815/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/400/300 -> https://fastly.picsum.photos/id/490/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/400/300 -> https://fastly.picsum.photos/id/305/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/400/300 -> https://fastly.picsum.photos/id/353/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/400/300 -> https://fastly.picsum.photos/id/816/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/400/300 -> https://fastly.picsum.photos/id/1/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/400/300 -> https://fastly.picsum.photos/id/610/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/400/300 -> https://fastly.picsum.photos/id/608/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/400/300 -> https://fastly.picsum.photos/id/131/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/400/300 -> https://fastly.picsum.photos/id/91/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/400/300 -> https://fastly.picsum.photos/id/687/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/1200/800 -> https://fastly.picsum.photos/id/91/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/400/300 -> https://fastly.picsum.photos/id/305/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/400/300 -> https://fastly.picsum.photos/id/131/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/400/300 -> https://fastly.picsum.photos/id/353/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/400/300 -> https://fastly.picsum.photos/id/91/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/400/300 -> https://fastly.picsum.photos/id/1/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/400/300 -> https://fastly.picsum.photos/id/687/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/400/300 -> https://fastly.picsum.photos/id/815/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/400/300 -> https://fastly.picsum.photos/id/608/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/400/300 -> https://fastly.picsum.photos/id/610/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/400/300 -> https://fastly.picsum.photos/id/816/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/400/300 -> https://fastly.picsum.photos/id/490/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/1200/800 -> https://fastly.picsum.photos/id/816/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/400/300 -> https://fastly.picsum.photos/id/687/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/400/300 -> https://fastly.picsum.photos/id/131/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/400/300 -> https://fastly.picsum.photos/id/305/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/400/300 -> https://fastly.picsum.photos/id/353/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/400/300 -> https://fastly.picsum.photos/id/608/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/400/300 -> https://fastly.picsum.photos/id/815/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/400/300 -> https://fastly.picsum.photos/id/91/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/400/300 -> https://fastly.picsum.photos/id/1/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/400/300 -> https://fastly.picsum.photos/id/816/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/400/300 -> https://fastly.picsum.photos/id/610/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/400/300 -> https://fastly.picsum.photos/id/490/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/1200/800 -> https://fastly.picsum.photos/id/305/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/400/300 -> https://fastly.picsum.photos/id/305/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/400/300 -> https://fastly.picsum.photos/id/687/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/400/300 -> https://fastly.picsum.photos/id/815/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/400/300 -> https://fastly.picsum.photos/id/91/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/400/300 -> https://fastly.picsum.photos/id/608/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/400/300 -> https://fastly.picsum.photos/id/490/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/400/300 -> https://fastly.picsum.photos/id/353/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/400/300 -> https://fastly.picsum.photos/id/131/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/400/300 -> https://fastly.picsum.photos/id/1/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/400/300 -> https://fastly.picsum.photos/id/816/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/400/300 -> https://fastly.picsum.photos/id/610/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/1200/800 -> https://fastly.picsum.photos/id/815/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/400/300 -> https://fastly.picsum.photos/id/490/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/400/300 -> https://fastly.picsum.photos/id/816/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/400/300 -> https://fastly.picsum.photos/id/815/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/400/300 -> https://fastly.picsum.photos/id/608/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/400/300 -> https://fastly.picsum.photos/id/91/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/400/300 -> https://fastly.picsum.photos/id/353/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/400/300 -> https://fastly.picsum.photos/id/305/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/400/300 -> https://fastly.picsum.photos/id/610/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/400/300 -> https://fastly.picsum.photos/id/687/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/400/300 -> https://fastly.picsum.photos/id/1/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/400/300 -> https://fastly.picsum.photos/id/131/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/1200/800 -> https://fastly.picsum.photos/id/608/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/400/300 -> https://fastly.picsum.photos/id/687/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/400/300 -> https://fastly.picsum.photos/id/490/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/400/300 -> https://fastly.picsum.photos/id/91/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/400/300 -> https://fastly.picsum.photos/id/816/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/400/300 -> https://fastly.picsum.photos/id/1/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/400/300 -> https://fastly.picsum.photos/id/305/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/400/300 -> https://fastly.picsum.photos/id/815/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/400/300 -> https://fastly.picsum.photos/id/353/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/400/300 -> https://fastly.picsum.photos/id/131/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/400/300 -> https://fastly.picsum.photos/id/610/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/400/300 -> https://fastly.picsum.photos/id/608/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/1200/800 -> https://fastly.picsum.photos/id/353/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/400/300 -> https://fastly.picsum.photos/id/490/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/400/300 -> https://fastly.picsum.photos/id/610/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/400/300 -> https://fastly.picsum.photos/id/353/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/400/300 -> https://fastly.picsum.photos/id/91/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/400/300 -> https://fastly.picsum.photos/id/815/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/400/300 -> https://fastly.picsum.photos/id/305/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/400/300 -> https://fastly.picsum.photos/id/1/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/400/300 -> https://fastly.picsum.photos/id/608/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/400/300 -> https://fastly.picsum.photos/id/816/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/400/300 -> https://fastly.picsum.photos/id/687/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/400/300 -> https://fastly.picsum.photos/id/131/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/1200/800 -> https://fastly.picsum.photos/id/131/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/400/300 -> https://fastly.picsum.photos/id/816/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/400/300 -> https://fastly.picsum.photos/id/131/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/400/300 -> https://fastly.picsum.photos/id/815/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/400/300 -> https://fastly.picsum.photos/id/353/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/400/300 -> https://fastly.picsum.photos/id/687/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/400/300 -> https://fastly.picsum.photos/id/1/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/400/300 -> https://fastly.picsum.photos/id/610/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/400/300 -> https://fastly.picsum.photos/id/608/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/400/300 -> https://fastly.picsum.photos/id/91/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/400/300 -> https://fastly.picsum.photos/id/490/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/400/300 -> https://fastly.picsum.photos/id/305/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/1200/800 -> https://fastly.picsum.photos/id/610/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/400/300 -> https://fastly.picsum.photos/id/1/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/400/300 -> https://fastly.picsum.photos/id/490/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/400/300 -> https://fastly.picsum.photos/id/608/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/400/300 -> https://fastly.picsum.photos/id/816/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/400/300 -> https://fastly.picsum.photos/id/131/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/400/300 -> https://fastly.picsum.photos/id/610/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/400/300 -> https://fastly.picsum.photos/id/353/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/400/300 -> https://fastly.picsum.photos/id/687/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/400/300 -> https://fastly.picsum.photos/id/91/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/400/300 -> https://fastly.picsum.photos/id/815/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/400/300 -> https://fastly.picsum.photos/id/305/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/1200/800 -> https://fastly.picsum.photos/id/1/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/400/300 -> https://fastly.picsum.photos/id/816/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/400/300 -> https://fastly.picsum.photos/id/815/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/400/300 -> https://fastly.picsum.photos/id/687/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/400/300 -> https://fastly.picsum.photos/id/1/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/400/300 -> https://fastly.picsum.photos/id/608/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/400/300 -> https://fastly.picsum.photos/id/305/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/400/300 -> https://fastly.picsum.photos/id/610/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/400/300 -> https://fastly.picsum.photos/id/131/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/400/300 -> https://fastly.picsum.photos/id/490/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/400/300 -> https://fastly.picsum.photos/id/353/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/400/300 -> https://fastly.picsum.photos/id/91/400/300.jpg (cross-origin redirect)