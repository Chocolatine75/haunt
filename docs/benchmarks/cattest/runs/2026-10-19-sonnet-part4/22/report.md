---
haunt: true
target: http://localhost:4122/
date: 2026-10-19
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

# Haunt Report — http://localhost:4122/
2026-10-19 · 2 areas · 0 issues

## Issues

_No issues found._

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

Checks that failed, and that no issue was filed for:
- "post" on `/` — expected: Posting adds new post at top — the page showed: []

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 5 of 34 controls exercised
- 4 test cases: 3 passed, 1 failed, 0 not run

Never exercised:
- generic "MS Morgan Smith @morgansmith20 2m Just deployed my first Rust microservice to production. The memory safety guarantee..." — `/`
- button "Reply" — `/`
- generic "MG Mia Garcia @miagarcia46 5m Hot take: TypeScript's type system is Turing complete and that's both amazing and terri..." — `/`
- generic "MK Max Kim @maxkim31 8m Day 45 of building my SaaS. Finally got payment integration working. Stripe's docs are chef's..." — `/`
- generic "SO Skyler Okafor @skylerokafor51 12m Anyone else think the AI code assistants are getting scary good? Just had one fi..." — `/`
- generic "RN Rowan Nakamura @rowannakamura19 18m The amount of JavaScript frameworks released this week is too damn high 68 65 227" — `/`
- generic "EW Eli Williams @eliwilliams15 25m Just realized my entire production database has been running without backups for 6..." — `/`
- generic "JC Jordan Chen @jordanchen21 33m Interviewer: 'What's your biggest weakness?' Me: 'I mass-produce side projects that ..." — `/`
- generic "EL Eli Lee @elilee6 45m TIL you can use CSS :has() selector in production now. Game changer for styling parent elemen..." — `/`
- generic "EP Ellis Patel @ellispatel52 58m Unpopular opinion: Monoliths are fine for 90% of startups. Stop over-engineering wit..." — `/`
- generic "RL Rowan Larson @rowanlarson59 1h My VS Code has more extensions than my app has users #IndieHacker #DevLife 24 147 299" — `/`
- button "Scroll to top" — `/`
- generic "Y You @currentuser now Hello 1 1" — `/`
- generic "EW Eli Williams @eliwilliams83 3m I use tabs. My coworker uses spaces. We've agreed to let the formatter handle it. P..." — `/`
- generic "JG Jordan Garcia @jordangarcia76 3m Three years ago I couldn't center a div. Today I'm leading a team of 8 engineers...." — `/`
- generic "SN Skyler Nakamura @skylernakamura27 5m Postgres is criminally underrated. Before reaching for Redis, have you tried ..." — `/`
- generic "RJ Rowan Johnson @rowanjohnson49 4m Python 3.12 performance improvements are no joke. Seeing 15-20% speedups on our M..." — `/`
- generic "FN Finley Nakamura @finleynakamura15 3m Had a production incident at 3 AM. Root cause: someone hardcoded a date that ..." — `/`
- generic "Show new posts" — `/`
- generic "JW Jane Williams @janewilliams66 2m Just deployed my first Rust microservice to production. The memory safety guarant..." — `/`
- generic "EJ Eli Johnson @elijohnson3 5m Hot take: TypeScript's type system is Turing complete and that's both amazing and terr..." — `/`
- generic "RP Rowan Park @rowanpark69 8m Day 45 of building my SaaS. Finally got payment integration working. Stripe's docs are ..." — `/`
- generic "RC Reese Chen @reesechen34 12m Anyone else think the AI code assistants are getting scary good? Just had one fix a bu..." — `/`
- generic "SG Skyler Garcia @skylergarcia16 18m The amount of JavaScript frameworks released this week is too damn high 51 83 236" — `/`
- generic "KS Kai Smith @kaismith5 25m Just realized my entire production database has been running without backups for 6 months..." — `/`
- generic "QS Quinn Smith @quinnsmith77 33m Interviewer: 'What's your biggest weakness?' Me: 'I mass-produce side projects that ..." — `/`
- generic "HM Harper Meyer @harpermeyer50 45m TIL you can use CSS :has() selector in production now. Game changer for styling pa..." — `/`
- generic "KK Kai Kumar @kaikumar63 58m Unpopular opinion: Monoliths are fine for 90% of startups. Stop over-engineering with mi..." — `/`
- generic "AR Avery Rivera @averyrivera10 1h My VS Code has more extensions than my app has users #IndieHacker #DevLife 22 86 163" — `/`

## Session Impressions

**/:** "No real defects found; composer, counter, posting, like, repost and new-posts banner worked. Coverage thin: 6 of 68 controls exercised."
**/:** "engine sweep"

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

_No issues found._

After fixing, run `/haunt:haunt-test http://localhost:4122/` again to verify.