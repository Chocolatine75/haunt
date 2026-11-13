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

- [MINOR] Whitespace-only text enables the Post button, but clicking it does nothing (no feedback, no message). (`http://localhost:4122/`)
- [MINOR] After 'Show 5 new posts', the new posts are ordered 1m, 4m, 3m, 4m, 3m and sit above the user's own 'now' post, so the feed is not chronological. (`http://localhost:4122/`)
  - Expected: Feed sorted newest first, with the 'now' post at the top
  - Seen: New posts appear unsorted above the 'now' post

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 7 of 35 controls exercised
- 3 test cases: 3 passed, 0 failed, 0 not run

Never exercised:
- generic "SB Skyler Brown @skylerbrown26 2m Just deployed my first Rust microservice to production. The memory safety guarantee..." — `/`
- generic "HJ Harper Johnson @harperjohnson71 5m Hot take: TypeScript's type system is Turing complete and that's both amazing a..." — `/`
- generic "AS Alex Singh @alexsingh41 8m Day 45 of building my SaaS. Finally got payment integration working. Stripe's docs are ..." — `/`
- generic "RW Riley Williams @rileywilliams13 12m Anyone else think the AI code assistants are getting scary good? Just had one ..." — `/`
- generic "SP Sage Park @sagepark71 18m The amount of JavaScript frameworks released this week is too damn high 10 46 338" — `/`
- generic "JT Jordan Tanaka @jordantanaka34 25m Just realized my entire production database has been running without backups for..." — `/`
- generic "LS Leo Scott @leoscott91 33m Interviewer: 'What's your biggest weakness?' Me: 'I mass-produce side projects that neve..." — `/`
- generic "FK Finley Kim @finleykim35 45m TIL you can use CSS :has() selector in production now. Game changer for styling parent..." — `/`
- generic "AO Alex Okafor @alexokafor49 58m Unpopular opinion: Monoliths are fine for 90% of startups. Stop over-engineering wit..." — `/`
- generic "MS Max Singh @maxsingh55 1h My VS Code has more extensions than my app has users #IndieHacker #DevLife 7 70 216" — `/`
- generic "Y You @currentuser now Shipping Chirp tests today" — `/`
- generic "AS Alex Scott @alexscott41 1m The 10x engineer myth needs to die. The real 10x is someone who makes their whole team ..." — `/`
- generic "SN Sage Nakamura @sagenakamura65 4m Observability > Monitoring. If you can't trace a request through your entire syst..." — `/`
- generic "AM Avery Meyer @averymeyer98 3m Functional programming isn't just about immutability - it's about making illegal stat..." — `/`
- generic "MK Max Kumar @maxkumar6 4m The gap between junior and senior isn't code quality - it's knowing what NOT to build. 2 5 36" — `/`
- generic "SG Sam Garcia @samgarcia21 3m I use tabs. My coworker uses spaces. We've agreed to let the formatter handle it. Peace..." — `/`
- generic "Chirp" — `/`
- generic "Show new posts" — `/`
- generic "RC Rowan Chen @rowanchen40 2m Just deployed my first Rust microservice to production. The memory safety guarantees ar..." — `/`
- generic "SG Skyler Garcia @skylergarcia24 5m Hot take: TypeScript's type system is Turing complete and that's both amazing and..." — `/`
- generic "JR Jane Rivera @janerivera61 8m Day 45 of building my SaaS. Finally got payment integration working. Stripe's docs ar..." — `/`
- generic "EO Eli Okafor @eliokafor70 12m Anyone else think the AI code assistants are getting scary good? Just had one fix a bu..." — `/`
- generic "JC Jane Chen @janechen83 18m The amount of JavaScript frameworks released this week is too damn high 5 114 293" — `/`
- generic "ZR Zoe Rivera @zoerivera51 25m Just realized my entire production database has been running without backups for 6 mon..." — `/`
- generic "MP Max Patel @maxpatel82 33m Interviewer: 'What's your biggest weakness?' Me: 'I mass-produce side projects that neve..." — `/`
- generic "ZP Zoe Park @zoepark39 45m TIL you can use CSS :has() selector in production now. Game changer for styling parent ele..." — `/`
- generic "RM Riley Meyer @rileymeyer88 58m Unpopular opinion: Monoliths are fine for 90% of startups. Stop over-engineering wit..." — `/`
- generic "QT Quinn Tanaka @quinntanaka26 1h My VS Code has more extensions than my app has users #IndieHacker #DevLife 24 138" — `/`

## Session Impressions

**/:** "Posting, like, repost and the character counter work. A whitespace-only draft enables Post but clicking does nothing; feed order after 'Show new posts' is not chronological. Coverage thin."
**/:** "engine sweep"

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

_No issues found._

After fixing, run `/haunt:haunt-test http://localhost:4122/` again to verify.