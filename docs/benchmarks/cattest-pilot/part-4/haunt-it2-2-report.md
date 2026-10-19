---
haunt: true
target: http://localhost:4102/
date: 2026-10-06
areas_tested: 2
issues:
  total: 3
  critical: 0
  major: 2
  minor: 1
signals:
  total: 0
  major: 0
  minor: 0
top_fix: "Trap focus in the dialog, mark it role=dialog aria-modal, make background inert."
---

# Haunt Report — http://localhost:4102/
2026-10-06 · 2 areas · 3 issues

## Issues

### 1. [MAJOR] Focus is not trapped in the open lightbox: Tab moves focus to gallery cards behind it (View Buffalo Standoff focused while lightbox shown).
- **Page:** `http://localhost:4102/`
- **Fix:** Trap focus in the dialog, mark it role=dialog aria-modal, make background inert.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/93daef72-b6b8-4a04-a353-b7189e45d4a6/issue-1` — reproduced 3 of 3 replays (100%)

### 2. [MAJOR] The gallery exposes 24 'View ...' buttons for 12 photos: a second set of 12 clickable button elements with no visible text duplicates every title, creating duplicate tab stops and screen reader entries.
- **Page:** `http://localhost:4102/`
- **Fix:** Remove the duplicate set of card buttons, or hide it from the accessibility tree and tab order.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/fe1329bf-d63b-4cfe-be41-0d7011460c43/issue-1` — reproduced 3 of 3 replays (100%)

### 3. [MINOR] After closing the lightbox with Escape, focus is not returned to the card that opened it. Pressing Tab five times and Enter afterwards opened Lioness at Dawn instead of Leopard's Vigil.
- **Page:** `http://localhost:4102/`
- **Fix:** Restore focus to the opening card when the lightbox closes.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/fe1329bf-d63b-4cfe-be41-0d7011460c43/issue-2` — reproduced 3 of 3 replays (100%)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MINOR] Gallery renders every photo card twice (24 view buttons for 12 photos). (`http://localhost:4102/`)
  - Expected: 12 distinct cards
  - Seen: 24 cards, every title appears twice
  - Steps: `.haunt-reports/evidence/93daef72-b6b8-4a04-a353-b7189e45d4a6/issue-2`

Checks that failed, and that no issue was filed for:
- "close-button" on `/` — expected: Close lightbox hides the dialog and the gallery is visible and scrollable again.
- "focus-trap" on `/` — expected: With the lightbox open, repeated Tab keeps focus on controls inside the lightbox and never reaches the page cards behind. — the page showed: false

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 9 of 46 controls exercised
- 18 test cases: 10 passed, 5 failed, 3 not run

Never exercised:
- button "View Elephant Herd Crossing" — `/`
- button "View Flamingo Reflections" — `/`
- button "View Zebra Migration" — `/`
- button "View Hippo at Dusk" — `/`
- button "View Giraffe Silhouette" — `/`
- button "View Crowned Crane Dance" — `/`
- button "View Buffalo Standoff" — `/`
- button "View Rhino Mother and Calf" — `/`
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
- generic "Cheetah in Full Stride — Masai Mara, Kenya" — `/`
- generic "Lioness at Dawn Elephant Herd Crossing Cheetah in Full Stride Flamingo Reflections Leopard's Vigil Zebra Migration Hi..." — `/`
- generic "Giraffe Silhouette — Tsavo East, Kenya" — `/`
- generic "" — `/`
- generic "The fastest land animal reaches top speed in pursuit of a Thomson's gazelle." — `/`
- generic "Cheetah in Full Stride Masai Mara, Kenya The fastest land animal reaches top speed in pursuit of a Thomson's gazelle." — `/`
- generic "Cheetah in Full Stride" — `/`
- generic "Lioness at Dawn — Serengeti National Park, Tanzania" — `/`
- generic "Lioness at Dawn" — `/`
- generic "Elephant Herd Crossing" — `/`
- generic "Leopard's Vigil" — `/`
- generic "Zebra Migration" — `/`
- generic "Crowned Crane Dance" — `/`
- generic "Buffalo Standoff" — `/`
- generic "Elena Vasquez Wildlife Photography — East Africa" — `/`
- generic "Lioness at Dawn Serengeti National Park, Tanzania Captured during the golden hour as the pride prepared for their eve..." — `/`
- generic "Leopard's Vigil — Ngorongoro Crater, Tanzania" — `/`
- generic "Leopard's Vigil Ngorongoro Crater, Tanzania A solitary leopard watches from an acacia branch as twilight descends ove..." — `/`

## Session Impressions

**/:** "Lightbox open, next/prev, wrap-around, jump, zoom, arrow keys and Escape worked. Focus is not trapped in the open lightbox, and the gallery lists every photo twice."
**/:** "The gallery exposes 24 View buttons for 12 photos, and focus is not returned to the opening card after Escape. The lightbox counter and navigation agree with the photo. The images-load and card-hover cases were not played."

## Top Fix

Trap focus in the dialog, mark it role=dialog aria-modal, make background inert.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4102/` — Trap focus in the dialog, mark it role=dialog aria-modal, make background inert.. Likely in `app/page.tsx`.
2. [MAJOR] `http://localhost:4102/` — Remove the duplicate set of card buttons, or hide it from the accessibility tree and tab order.. Likely in `app/page.tsx`.
3. [MINOR] `http://localhost:4102/` — Restore focus to the opening card when the lightbox closes.. Likely in `app/page.tsx`.

After fixing, run `/haunt:haunt-test http://localhost:4102/` again to verify.

## Sandbox-Blocked Requests

These are not app bugs — the test sandbox blocked an attempt to reach an origin outside the target app, shown here for visibility into what the persona tried.

- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/400/300 -> https://fastly.picsum.photos/id/490/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/400/300 -> https://fastly.picsum.photos/id/131/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/400/300 -> https://fastly.picsum.photos/id/608/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/400/300 -> https://fastly.picsum.photos/id/1/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/400/300 -> https://fastly.picsum.photos/id/305/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/400/300 -> https://fastly.picsum.photos/id/610/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/400/300 -> https://fastly.picsum.photos/id/815/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/400/300 -> https://fastly.picsum.photos/id/816/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/400/300 -> https://fastly.picsum.photos/id/91/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/400/300 -> https://fastly.picsum.photos/id/353/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/400/300 -> https://fastly.picsum.photos/id/687/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/1200/800 -> https://fastly.picsum.photos/id/500/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/1200/800 -> https://fastly.picsum.photos/id/1/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/1200/800 -> https://fastly.picsum.photos/id/500/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/1200/800 -> https://fastly.picsum.photos/id/815/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/1200/800 -> https://fastly.picsum.photos/id/608/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/1200/800 -> https://fastly.picsum.photos/id/490/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/1200/800 -> https://fastly.picsum.photos/id/490/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/400/300 -> https://fastly.picsum.photos/id/687/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/400/300 -> https://fastly.picsum.photos/id/816/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/400/300 -> https://fastly.picsum.photos/id/91/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/400/300 -> https://fastly.picsum.photos/id/490/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/400/300 -> https://fastly.picsum.photos/id/305/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/400/300 -> https://fastly.picsum.photos/id/815/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/400/300 -> https://fastly.picsum.photos/id/353/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/400/300 -> https://fastly.picsum.photos/id/610/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/400/300 -> https://fastly.picsum.photos/id/131/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/400/300 -> https://fastly.picsum.photos/id/608/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/400/300 -> https://fastly.picsum.photos/id/1/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/1200/800 -> https://fastly.picsum.photos/id/1/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/1200/800 -> https://fastly.picsum.photos/id/500/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/1200/800 -> https://fastly.picsum.photos/id/815/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/1200/800 -> https://fastly.picsum.photos/id/608/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/1200/800 -> https://fastly.picsum.photos/id/500/1200/800.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/400/300 -> https://fastly.picsum.photos/id/816/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/flamingo4/400/300 -> https://fastly.picsum.photos/id/91/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/elephant2/400/300 -> https://fastly.picsum.photos/id/687/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/zebra6/400/300 -> https://fastly.picsum.photos/id/305/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/wilddog12/400/300 -> https://fastly.picsum.photos/id/1/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/giraffe8/400/300 -> https://fastly.picsum.photos/id/608/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/rhino11/400/300 -> https://fastly.picsum.photos/id/610/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/hippo7/400/300 -> https://fastly.picsum.photos/id/815/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/crane9/400/300 -> https://fastly.picsum.photos/id/353/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/buffalo10/400/300 -> https://fastly.picsum.photos/id/131/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/cheetah3/400/300 -> https://fastly.picsum.photos/id/490/400/300.jpg (cross-origin redirect)
- GET https://picsum.photos/seed/leopard5/1200/800 -> https://fastly.picsum.photos/id/816/1200/800.jpg (cross-origin redirect)