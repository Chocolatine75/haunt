---
haunt: true
target: http://localhost:4146/
date: 2026-11-12
areas_tested: 2
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

# Haunt Report — http://localhost:4146/
2026-11-12 · 2 areas · 0 issues

## Issues

_No issues found._

## Flaky

Replayed in a fresh browser, these happened only some of the time: real, but not every time.

- [MINOR] Copy Link share button throws an unhandled promise rejection when clipboard write fails, with no feedback to the user (`http://localhost:4146/`) — evidence: `.haunt-reports/evidence/ed95ccba-651a-4d7e-99c6-74535aaff9d3/issue-1` — reproduced 7 of 10 replays (70%)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MINOR] Escape does not close the scratch card modal; game cards are non-button divs; lock icon still overlaps the icon on unlocked game cards (`http://localhost:4146/`)
  - Expected: Escape closes the modal; cards keyboard-operable; no lock overlay once unlocked
  - Seen: Escape did nothing; cards are generic divs; lock icon still shown
  - Steps: `.haunt-reports/evidence/ed95ccba-651a-4d7e-99c6-74535aaff9d3/issue-2`

Checks that failed, and that no issue was filed for:
- "bad-email" on `/` — expected: Invalid email keeps games locked

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 12 of 27 controls exercised
- 2 test cases: 1 passed, 1 failed, 0 not run

Never exercised:
- link "Privacy Policy" — `/`
- button "📋 Copy Code" — `/`
- generic "× 🎡 Spin the Wheel! Click SPIN and watch where fate takes you! 🎰 SPIN" — `/`
- button "𝕏 Tweet" — `/`
- button "f Share" — `/`
- button "💬 WhatsApp" — `/`
- generic "" — `/`
- generic "🎉 Congratulations! You won: 10% Off! BEAN-JN5D-1RCN 📋 Copy Code 🎟 Share for a Bonus Entry! Share to enter our gran..." — `/`
- generic "× 🎲 Roll the Dice! Roll doubles to win! Higher pairs = bigger prizes! ⚀ ⚀ 🎲 ROLL!" — `/`
- generic "× 🎫 Scratch to Reveal! Use your mouse or finger to scratch the golden card! 🎉 10% Off Scratch at least 50% to revea..." — `/`
- generic "× 🏆 Your Prizes 🏆 10% Off BEAN-JN5D-1RCN Won from: Spin Wheel" — `/`
- generic "× Terms & Conditions 1. This promotion is run by BeanBrew Coffee Co. for entertainment and marketing purposes. 2. No ..." — `/`
- generic "10. Void where prohibited by law. Must be 18+ to participate." — `/`
- generic "8. BeanBrew reserves the right to cancel or modify the promotion at any time." — `/`
- generic "Terms & Conditions" — `/`

## Session Impressions

**/:** "Main flow works: email unlock, wheel spin, dice roll, prizes panel and Terms dialog behaved. Minor issues: Copy Link throws an unhandled clipboard rejection with no feedback; Escape doesn't close the scratch card modal; lock icons stay over unlocked game cards. Scratch card not completed (needs pointer drag)."
**/:** "engine sweep"

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

_No issues found._

After fixing, run `/haunt:haunt-test http://localhost:4146/` again to verify.