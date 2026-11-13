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

### 1. [MAJOR] The six call control buttons (mic, camera, volume, share screen, participants, end call) have no accessible name, only icons.
- **Page:** `http://localhost:4124/`
- **Fix:** Add aria-label to each icon button.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Buttons must have discernible text (6 elements) — `http://localhost:4124/` (step 0)
- **Evidence:** `.haunt-reports/evidence/2704f494-e38f-497f-b2a3-1e44ad62d868/issue-1` — reproduced 3 of 3 replays (100%)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

Checks that failed, and that no issue was filed for:
- "minimize" on `/` — expected: Minimize shows the mini window with Expand button
- "keyboard" on `/` — expected: Control buttons reachable by Tab — the page showed: false

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 8 of 20 controls exercised
- 3 test cases: 1 passed, 2 failed, 0 not run

Never exercised:
- generic "Dashboard" — `/`
- generic "Messages" — `/`
- generic "Settings" — `/`
- button "Stop Sharing" — `/`
- slider "" — `/`
- generic "00:00:33" — `/`
- button "End Call" — `/`
- generic "" — `/`
- generic "Participants (2) ×" — `/`
- generic "A Alex (You) 🎤 📷 J Jordan 🎤 📷" — `/`
- generic "Alex" — `/`
- generic "00:00:03" — `/`

## Session Impressions

**/:** "Icon-only call controls have no accessible name; other controls worked."
**/:** "engine sweep"

## Top Fix

Add aria-label to each icon button.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4124/` — Add aria-label to each icon button.. Likely in `app/page.tsx`.

After fixing, run `/haunt:haunt-test http://localhost:4124/` again to verify.