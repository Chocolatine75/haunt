---
haunt: true
target: http://localhost:4124/
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
top_fix: "Add aria-label to each control button."
---

# Haunt Report — http://localhost:4124/
2026-10-19 · 2 areas · 1 issues

## Issues

### 1. [MAJOR] Six call control buttons (mic, camera, volume, share, participants, end call) have no accessible name and are icon-only.
- **Page:** `http://localhost:4124/`
- **Fix:** Add aria-label to each control button.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Buttons must have discernible text (6 elements) — `http://localhost:4124/` (step 0)
- **Evidence:** `.haunt-reports/evidence/112796d7-f0bd-4a37-a02c-843db7d1493b/issue-1` — reproduced 3 of 3 replays (100%)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MINOR] While screen sharing, the 'Stop Sharing' button is covered by an overlay element and cannot be clicked. A click on it opened the Participants panel instead of stopping the share. (`http://localhost:4124/`)
  - Expected: Stop Sharing is visible and clicking it stops sharing
  - Seen: Button covered by an overlay, and the click opened the Participants panel

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 6 of 21 controls exercised
- 1 test cases: 1 passed, 0 failed, 0 not run

Never exercised:
- generic "Dashboard" — `/`
- generic "Projects" — `/`
- generic "Messages" — `/`
- generic "Settings" — `/`
- slider "" — `/`
- generic "00:00:10" — `/`
- button "Expand to full view" — `/`
- button "Toggle Microphone" — `/`
- button "End Call" — `/`
- generic "" — `/`
- generic "Participants (2) ×" — `/`
- generic "A Alex (You) 🎤 📷 J Jordan 🎤 📷" — `/`
- generic "Alex" — `/`
- generic "00:00:00" — `/`
- generic "00:00:05" — `/`

## Session Impressions

**/:** "Six icon-only call buttons have no accessible name. Stop Sharing is covered by an overlay while screen sharing and opened the Participants panel instead. Controls auto-hide with pointer-events off. Mute, camera, share, participants, end call and rejoin worked."
**/:** "engine sweep"

## Top Fix

Add aria-label to each control button.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4124/` — Add aria-label to each control button.. Likely in `app/page.tsx`.

After fixing, run `/haunt:haunt-test http://localhost:4124/` again to verify.