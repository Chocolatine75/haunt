---
haunt: true
target: http://localhost:4146/
date: 2026-10-19
areas_tested: 2
issues:
  total: 0
  critical: 0
  major: 0
  minor: 0
signals:
  total: 1
  major: 1
  minor: 0
top_fix: ""
---

# Haunt Report — http://localhost:4146/
2026-10-19 · 2 areas · 0 issues

## Issues

_No issues found._

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] The button "🏆 Your Prizes" is covered by the generic "× 🏆 Your Prizes 🏆 10% Off BEAN-WA4N-46AU Won from: Spin Wheel": a click on it lands on what covers it — `http://localhost:4146/` (step 36)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MINOR] After the games are unlocked and played, the padlock icon still overlays the game cards (over the icon and title), alongside the completed check mark. (`http://localhost:4146/`)
  - Expected: Padlock removed once games are unlocked
  - Seen: Padlock overlaps icon and title on played cards
  - Steps: `.haunt-reports/evidence/e6d52cba-e15e-4315-b68b-70a64f2b6221/issue-1`
- [MINOR] Scratch card did not reveal its prize after scratching well over 50% of the surface (may be a simulated input artifact). (`http://localhost:4146/`)
  - Expected: Prize revealed after 50% scratched
  - Seen: No reveal, no prize recorded
  - Steps: `.haunt-reports/evidence/e6d52cba-e15e-4315-b68b-70a64f2b6221/issue-2`

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 13 of 23 controls exercised
- 3 test cases: 3 passed, 0 failed, 0 not run

Never exercised:
- link "Terms & Conditions" — `/`
- link "Privacy Policy" — `/`
- button "📋 Copy Code" — `/`
- generic "× 🎡 Spin the Wheel! Click SPIN and watch where fate takes you! 🎰 SPIN" — `/`
- button "💬 WhatsApp" — `/`
- button "🔗 Copy Link" — `/`
- generic "" — `/`
- generic "🎉 Congratulations! You won: 10% Off! BEAN-WA4N-46AU 📋 Copy Code 🎟 Share for a Bonus Entry! Share to enter our gran..." — `/`
- generic "× 🎲 Roll the Dice! Roll doubles to win! Higher pairs = bigger prizes! ⚀ ⚀ 🎲 ROLL!" — `/`
- generic "× 🏆 Your Prizes 🏆 10% Off BEAN-WA4N-46AU Won from: Spin Wheel" — `/`

## Session Impressions

**/:** "Core flow works: email unlock, wheel spin, dice roll, share bonus entry and Your Prizes panel. Two issues to check by hand: padlock icon overlaps game cards after unlock; scratch card did not reveal prize after scratching."
**/:** "engine sweep"

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

_No issues found._

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4146/` again to verify.

## Sandbox-Blocked Requests

These are not app bugs — the test sandbox blocked an attempt to reach an origin outside the target app, shown here for visibility into what the persona tried.

- GET https://www.facebook.com/sharer/sharer.php
- GET https://twitter.com/intent/tweet