---
haunt: true
target: http://localhost:4130/
date: 2026-11-12
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

# Haunt Report — http://localhost:4130/
2026-11-12 · 2 areas · 0 issues

## Issues

_No issues found._

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] Elements must meet minimum color contrast ratio thresholds (8 elements) — `http://localhost:4130/` (step 0)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [CRITICAL] Reading a secret (card click then Read it) opens an empty modal with only an x; the secret text is never shown, the burn still happens (burned 3->4), and the x does not close the overlay, blocking the whole page. (`http://localhost:4130/`)

Checks that failed, and that no issue was filed for:
- "read-burn" on `/` — expected: Reading the 1-read-left secret burns it and burned count becomes 4

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 17 of 67 controls exercised
- 3 test cases: 2 passed, 1 failed, 0 not run

Never exercised:
- button "🔇" — `/`
- button "All" — `/`
- combobox "Sort:" — `/`
- generic "C Crimson Serpent #3328 confession Sometimes I drive to the beach at 3am just to scream into the ocean. It's the on....." — `/`
- generic "D Drowsy Willow #9471 love The stranger who smiled at me on the subway this morning made me cry when I got ... 👁️ 3 ..." — `/`
- generic "V Velvet River #1746 hope I'm learning to paint in secret. I'm terrible at it but it makes me feel alive f... ⏱️ 3:24..." — `/`
- generic "G Glacial River #1193 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 4:0..." — `/`
- generic "W Wild Ivy #4180 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 21:54 ta..." — `/`
- generic "D Drifting Storm #3427 fear I've been applying to jobs in another country without telling my partner. I don'... ⏱️ 5:..." — `/`
- generic "E Ethereal Orchid #6726 regret I got promoted today but I can't tell anyone because my best friend applied for ... ⏱️..." — `/`
- generic "S Shattered Ash #7629 confession I pretend to be happy at work every single day, but I haven't felt real joy in m... ..." — `/`
- generic "W Wistful Star #6563 love I still write letters to my grandmother even though she passed away three years ... 👁️ 4 r..." — `/`
- combobox "Burn Mode:" — `/`
- button "Back away" — `/`
- textbox "" — `/`
- button "📋" — `/`
- generic "" — `/`
- generic "V Velvet River #1746 hope I'm learning to paint in secret. I'm terrible at it but it makes me feel alive f... ⏱️ 2:55..." — `/`
- generic "G Glacial River #1193 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 3:3..." — `/`
- generic "W Wild Ivy #4180 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 21:25 ta..." — `/`
- generic "W Wandering Willow #5366 hope I still keep my old teddy bear on the shelf. 👁️ 1 read left tap to read" — `/`
- generic "V Velvet River #1746 hope I'm learning to paint in secret. I'm terrible at it but it makes me feel alive f... ⏱️ 2:38..." — `/`
- generic "G Glacial River #1193 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 3:2..." — `/`
- generic "W Wild Ivy #4180 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 21:08 ta..." — `/`
- generic "Your secret is now on the wall." — `/`
- generic "Direct Link:" — `/`
- generic "× 🕊️ Your secret is now on the wall. You are Wandering Willow #5366 No one can trace this back to you. Whisper ID: 6..." — `/`
- generic "Whisper ID: 6dq14m3j Direct Link: 📋" — `/`
- generic "🕳️ How Tree Hole Works" — `/`
- generic "🎭 Complete Anonymity No login, no tracking. Each post gets a randomly generated identity that cannot be traced back ..." — `/`
- generic "× 🕳️ How Tree Hole Works 🎭 Complete Anonymity No login, no tracking. Each post gets a randomly generated identity t..." — `/`
- generic "× Whisper Your Secret No one will know who you are. Your identity is randomly generated. 0 /500 Mood (optional): conf..." — `/`
- generic "Whisper Your Secret" — `/`
- generic "0 /500" — `/`
- generic "W Wistful Owl #5777 funny I laugh at my own jokes when I'm alone in my apartment. Full belly laughs. I thi... 👁️ 1 r..." — `/`
- generic "T Tender Willow #3858 hope I'm learning to paint in secret. I'm terrible at it but it makes me feel alive f... ⏱️ 3:2..." — `/`
- generic "M Misty Dove #4265 love I still write letters to my grandmother even though she passed away three years ... 👁️ 4 rea..." — `/`
- generic "A Amber Ivy #5684 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 4:11 ta..." — `/`
- generic "B Broken Ghost #9256 fear I've been applying to jobs in another country without telling my partner. I don'... ⏱️ 5:59..." — `/`
- generic "Q Quiet Echo #2964 regret I got promoted today but I can't tell anyone because my best friend applied for ... ⏱️ 17:5..." — `/`
- generic "B Broken Frost #6293 confession Sometimes I drive to the beach at 3am just to scream into the ocean. It's the on... �..." — `/`
- generic "B Burning Panther #4232 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 2..." — `/`
- generic "S Scarlet Whisper #7540 confession I pretend to be happy at work every single day, but I haven't felt real joy in m....." — `/`
- generic "P Phantom Star #7469 love The stranger who smiled at me on the subway this morning made me cry when I got ... 👁️ 3 r..." — `/`
- generic "A Amber Ivy #5684 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 4:06 ta..." — `/`
- generic "T Tender Willow #3858 hope I'm learning to paint in secret. I'm terrible at it but it makes me feel alive f... ⏱️ 3:1..." — `/`
- generic "A Amber Ivy #5684 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 4:00 ta..." — `/`
- generic "A Amber Ivy #5684 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 3:54 ta..." — `/`
- generic "T Tender Willow #3858 hope I'm learning to paint in secret. I'm terrible at it but it makes me feel alive f... ⏱️ 3:0..." — `/`
- generic "A Amber Ivy #5684 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 3:49 ta..." — `/`

## Session Impressions

**/:** "Reading a secret opens an empty modal that cannot be closed; the secret still burns. Filtering, sharing and help dialog worked."
**/:** "engine sweep"

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

_No issues found._

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4130/` again to verify.