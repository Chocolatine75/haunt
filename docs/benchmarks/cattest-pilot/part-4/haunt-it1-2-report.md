---
haunt: true
target: http://localhost:4102/
date: 2026-10-06
areas_tested: 1
issues:
  total: 0
  critical: 0
  major: 0
  minor: 0
signals:
  total: 0
  major: 0
  minor: 0
top_fix: ""
---

# Haunt Report — http://localhost:4102/
2026-10-06 · 1 areas · 0 issues

## Issues

_No issues found._

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 8 of 39 controls exercised
- 13 test cases: 9 passed, 1 failed, 3 not run

Never exercised:
- button "View Cheetah in Full Stride" — `/`
- button "View Flamingo Reflections" — `/`
- button "View Leopard's Vigil" — `/`
- button "View Hippo at Dusk" — `/`
- button "View Giraffe Silhouette" — `/`
- button "View Crowned Crane Dance" — `/`
- button "View Buffalo Standoff" — `/`
- button "View Rhino Mother and Calf" — `/`
- button "View Wild Dog Pack at Rest" — `/`
- button "Close lightbox" — `/`
- button "Jump to Lioness at Dawn" — `/`
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
- generic "Lioness at Dawn Elephant Herd Crossing Cheetah in Full Stride Flamingo Reflections Leopard's Vigil Zebra Migration Hi..." — `/`
- generic "Hippo at Dusk — Okavango Delta, Botswana" — `/`
- generic "Elena Vasquez Wildlife Photography — East Africa" — `/`
- generic "" — `/`
- generic "Lioness at Dawn" — `/`
- generic "Elephant Herd Crossing" — `/`
- generic "Leopard's Vigil" — `/`
- generic "Zebra Migration" — `/`
- generic "Crowned Crane Dance" — `/`
- generic "Buffalo Standoff" — `/`

## Session Impressions

**/:** "No confirmed issues. Open, next/prev, wrap-around, thumbnail jump, arrow keys, Escape and second button set worked; counter and caption matched. Focus-trap, scroll-lock and zoom observations were rejected on verification. Not played: open-last, page-content, caption-agrees on Cheetah. Sandbox blocked external images."

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

_No issues found._

After fixing, run `/haunt:haunt-test http://localhost:4102/` again to verify.

## Sandbox-Blocked Requests

These are not app bugs — the test sandbox blocked an attempt to reach an origin outside the target app, shown here for visibility into what the persona tried.

- GET https://picsum.photos/seed/elephant2/400/300 -> https://fastly.picsum.photos/id/687/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/400/300 -> https://fastly.picsum.photos/id/608/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/400/300 -> https://fastly.picsum.photos/id/353/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/400/300 -> https://fastly.picsum.photos/id/91/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/400/300 -> https://fastly.picsum.photos/id/305/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/400/300 -> https://fastly.picsum.photos/id/1/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/400/300 -> https://fastly.picsum.photos/id/816/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/400/300 -> https://fastly.picsum.photos/id/490/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/400/300 -> https://fastly.picsum.photos/id/131/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/400/300 -> https://fastly.picsum.photos/id/815/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/400/300 -> https://fastly.picsum.photos/id/610/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/1200/800 -> https://fastly.picsum.photos/id/500/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/1200/800 -> https://fastly.picsum.photos/id/687/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/1200/800 -> https://fastly.picsum.photos/id/500/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/1200/800 -> https://fastly.picsum.photos/id/1/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/1200/800 -> https://fastly.picsum.photos/id/500/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/1200/800 -> https://fastly.picsum.photos/id/815/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/1200/800 -> https://fastly.picsum.photos/id/608/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/1200/800 -> https://fastly.picsum.photos/id/815/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/1200/800 -> https://fastly.picsum.photos/id/608/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/1200/800 -> https://fastly.picsum.photos/id/687/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/1200/800 -> https://fastly.picsum.photos/id/305/1200/800.jpg (cross-origin redirect)