---
haunt: true
target: http://localhost:4146/
date: 2026-11-13
areas_tested: 2
issues:
  total: 1
  critical: 0
  major: 1
  minor: 0
signals:
  total: 1
  major: 1
  minor: 0
top_fix: "Catch clipboard errors and show a message"
---

# Haunt Report — http://localhost:4146/
2026-11-13 · 2 areas · 1 issues

## Issues

### 1. [MAJOR] Copy Code throws an unhandled clipboard rejection and gives the user no feedback
- **Page:** `http://localhost:4146/`
- **Fix:** Catch clipboard errors and show a message
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Failed to execute 'writeText' on 'Clipboard': Write permission denied. — `http://localhost:4146/` (step 8)
- **Evidence:** `.haunt-reports/evidence/fd239df0-4e7a-4fd5-b94e-4ae48488e48d/issue-2` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] The button "🏆 Your Prizes" is covered by the generic "× 🏆 Your Prizes 🏆 20% Off BEAN-X1MU-UOXL Won from: Spin Wheel 🏆 10% Off BEAN-43SK-UHGM Won from: Dice Roll": a click on it lands on what covers it — `http://localhost:4146/` (step 18)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MINOR] Escape does not close the scratch card modal (`http://localhost:4146/`)
- [MINOR] Lock icons still overlay the game cards after games are unlocked (`http://localhost:4146/`)
  - Expected: Lock icons removed after email unlock
  - Seen: Padlock icons still shown on all cards after unlocking

Checks that failed, and that no issue was filed for:
- "bad-email" on `/` — expected: Invalid email shows an error and the games stay locked

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 13 of 23 controls exercised
- 2 test cases: 1 passed, 1 failed, 0 not run

Never exercised:
- link "Terms & Conditions" — `/`
- link "Privacy Policy" — `/`
- generic "× 🎡 Spin the Wheel! Click SPIN and watch where fate takes you! 🎰 SPIN" — `/`
- button "𝕏 Tweet" — `/`
- button "💬 WhatsApp" — `/`
- button "🔗 Copy Link" — `/`
- generic "" — `/`
- generic "🎉 Congratulations! You won: 10% Off! BEAN-43SK-UHGM 📋 Copy Code 🎟 Share for a Bonus Entry! Share to enter our gran..." — `/`
- generic "× 🏆 Your Prizes 🏆 20% Off BEAN-X1MU-UOXL Won from: Spin Wheel 🏆 10% Off BEAN-43SK-UHGM Won from: Dice Roll" — `/`
- generic "Use your mouse or finger to scratch the golden card!" — `/`

## Session Impressions

**/:** "Email unlock, wheel spin, dice roll and prizes panel work. Found: Copy Code throws an unhandled clipboard rejection with no user feedback; Escape does not close the scratch-card modal; padlock icons remain after unlock; Your Prizes tab covered by panel/modal. Scratch-to-reveal not tested."
**/:** "engine sweep"

## Top Fix

Catch clipboard errors and show a message

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4146/` — Catch clipboard errors and show a message. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4146/` again to verify.

## Sandbox-Blocked Requests

These are not app bugs — the test sandbox blocked an attempt to reach an origin outside the target app, shown here for visibility into what the persona tried.

- GET https://www.facebook.com/sharer/sharer.php