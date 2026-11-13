---
haunt: true
target: http://localhost:4122/
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

# Haunt Report — http://localhost:4122/
2026-11-12 · 2 areas · 0 issues

## Issues

_No issues found._

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MINOR] Post button is enabled when the composer contains only spaces (`http://localhost:4122/`)
- [MINOR] Reply button gives no feedback: no dialog, no count change, nothing happens (`http://localhost:4122/`)
- [MINOR] Post button looks enabled with whitespace-only text but clicking does nothing (dead control) (`http://localhost:4122/`)

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 7 of 33 controls exercised
- 8 test cases: 6 passed, 2 failed, 0 not run

Never exercised:
- generic "AB Alex Brown @alexbrown8 2m Just deployed my first Rust microservice to production. The memory safety guarantees are..." — `/`
- generic "SG Sam Garcia @samgarcia61 5m Hot take: TypeScript's type system is Turing complete and that's both amazing and terri..." — `/`
- generic "JL Jordan Larson @jordanlarson14 8m Day 45 of building my SaaS. Finally got payment integration working. Stripe's doc..." — `/`
- generic "BC Blake Chen @blakechen70 12m Anyone else think the AI code assistants are getting scary good? Just had one fix a bu..." — `/`
- generic "HM Harper Meyer @harpermeyer59 18m The amount of JavaScript frameworks released this week is too damn high 62 23 102" — `/`
- generic "MK Mia Kumar @miakumar63 25m Just realized my entire production database has been running without backups for 6 month..." — `/`
- generic "JC Jordan Chen @jordanchen33 33m Interviewer: 'What's your biggest weakness?' Me: 'I mass-produce side projects that ..." — `/`
- generic "JK Jane Kumar @janekumar40 45m TIL you can use CSS :has() selector in production now. Game changer for styling parent..." — `/`
- generic "HS Harper Singh @harpersingh57 58m Unpopular opinion: Monoliths are fine for 90% of startups. Stop over-engineering w..." — `/`
- generic "JK Jane Kumar @janekumar32 1h My VS Code has more extensions than my app has users #IndieHacker #DevLife 46 408" — `/`
- generic "Y You @currentuser now Hello Chirp" — `/`
- generic "AT Avery Tanaka @averytanaka94 3m The best career advice I ever got: 'Be the person who writes the documentation.' It..." — `/`
- generic "JS Jordan Scott @jordanscott97 4m Python 3.12 performance improvements are no joke. Seeing 15-20% speedups on our ML ..." — `/`
- generic "EM Eli Meyer @elimeyer8 3m Had a production incident at 3 AM. Root cause: someone hardcoded a date that assumed Febru..." — `/`
- generic "Chirp" — `/`
- generic "Show new posts" — `/`
- generic "RL Riley Lee @rileylee73 2m Just deployed my first Rust microservice to production. The memory safety guarantees are ..." — `/`
- generic "MZ Morgan Zhang @morganzhang55 5m Hot take: TypeScript's type system is Turing complete and that's both amazing and t..." — `/`
- generic "AL Avery Lee @averylee87 8m Day 45 of building my SaaS. Finally got payment integration working. Stripe's docs are ch..." — `/`
- generic "RL Rowan Lee @rowanlee23 12m Anyone else think the AI code assistants are getting scary good? Just had one fix a bug ..." — `/`
- generic "RW Rowan Williams @rowanwilliams94 18m The amount of JavaScript frameworks released this week is too damn high 40 36 23" — `/`
- generic "MO Max Okafor @maxokafor23 25m Just realized my entire production database has been running without backups for 6 mon..." — `/`
- generic "LL Leo Larson @leolarson31 33m Interviewer: 'What's your biggest weakness?' Me: 'I mass-produce side projects that ne..." — `/`
- generic "SO Skyler Okafor @skylerokafor8 45m TIL you can use CSS :has() selector in production now. Game changer for styling p..." — `/`
- generic "FJ Finley Johnson @finleyjohnson30 58m Unpopular opinion: Monoliths are fine for 90% of startups. Stop over-engineeri..." — `/`
- generic "RG Reese Garcia @reesegarcia58 1h My VS Code has more extensions than my app has users #IndieHacker #DevLife 4 1 241" — `/`

## Session Impressions

**/:** "Feed mostly works; Post enabled with whitespace-only input but does nothing; Reply button on first post does nothing."
**/:** "engine sweep"

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

_No issues found._

After fixing, run `/haunt:haunt-test http://localhost:4122/` again to verify.