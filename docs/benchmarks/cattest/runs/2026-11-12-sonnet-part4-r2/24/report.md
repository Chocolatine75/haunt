---
haunt: true
target: http://localhost:4124/
date: 2026-11-12
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
top_fix: "Add aria-label to each icon button."
---

# Haunt Report — http://localhost:4124/
2026-11-12 · 2 areas · 1 issues

## Issues

### 1. [MAJOR] Six call control buttons (mic, camera, volume, share, participants, end call) have no accessible name; only a visual tooltip on hover.
- **Page:** `http://localhost:4124/`
- **Fix:** Add aria-label to each icon button.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Buttons must have discernible text (6 elements) — `http://localhost:4124/` (step 0)
- **Evidence:** `.haunt-reports/evidence/1897a52a-0318-42c3-924a-c18eb7652958/issue-1` — reproduced 3 of 3 replays (100%)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MINOR] While screen sharing, Jordan's self-view tile overlaps the minimize button at top right; the Stop Sharing button is covered by an overlay element and cannot be clicked. (`http://localhost:4124/`)
  - Expected: Minimize and Stop Sharing remain visible and clickable while sharing
  - Seen: Tile covers minimize button; Stop Sharing reported covered by another element
  - Steps: `.haunt-reports/evidence/1897a52a-0318-42c3-924a-c18eb7652958/issue-2`

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 8 of 19 controls exercised
- 5 test cases: 5 passed, 0 failed, 0 not run

Never exercised:
- generic "Dashboard" — `/`
- generic "Projects" — `/`
- generic "Messages" — `/`
- generic "Settings" — `/`
- button "Stop Sharing" — `/`
- generic "00:00:15" — `/`
- button "Expand to full view" — `/`
- generic "" — `/`
- generic "Participants (2) ×" — `/`
- generic "A Alex (You) 🎤 📷 J Jordan 🎤 📷" — `/`
- generic "00:00:03" — `/`

## Session Impressions

**/:** "Call control buttons lack accessible names; self-view tile overlaps minimize button while sharing; controls fade out and ignore pointer until hover. All 5 cases passed."
**/:** "engine sweep"

## Top Fix

Add aria-label to each icon button.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4124/` — Add aria-label to each icon button.. Likely in `app/page.tsx`.

After fixing, run `/haunt:haunt-test http://localhost:4124/` again to verify.