---
haunt: true
target: http://localhost:4130/
date: 2026-11-12
areas_tested: 2
issues:
  total: 1
  critical: 0
  major: 0
  minor: 1
signals:
  total: 0
  major: 0
  minor: 0
top_fix: "Increase contrast of muted text."
---

# Haunt Report — http://localhost:4130/
2026-11-12 · 2 areas · 1 issues

## Issues

### 1. [MINOR] Color contrast failure on 8 elements (axe color-contrast).
- **Page:** `http://localhost:4130/`
- **Fix:** Increase contrast of muted text.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Elements must meet minimum color contrast ratio thresholds (8 elements) — `http://localhost:4130/` (step 0)
- **Evidence:** `.haunt-reports/evidence/7d5e7c0b-dc06-45b8-8bd8-d9332858bd06/issue-4` — reproduced 3 of 3 replays (100%)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MAJOR] Reading a secret on its last read: after 'Read it' is clicked, an empty modal (only an x) appears and the secret's full text is never shown; the secret is burned (burned count rises) and the reader loses it. Reproduced on a seeded card (Shattered Opal) and a freshly shared one. Non-final reads show the text correctly. (`http://localhost:4130/`)
  - Expected: The final read shows the full secret text (with a burn animation), then burns it
  - Seen: Blank modal with only a close button; text never displayed
- [MINOR] Escape does not close the open reveal modal; focus is not released and the page behind stays covered. (`http://localhost:4130/`)
  - Expected: Escape closes the modal
  - Seen: Nothing happens; only the x button closes it
- [MINOR] Confirmation dialog says '1 reads remaining' (bad plural) while the card says '1 read left'. (`http://localhost:4130/`)
  - Expected: 1 read remaining
  - Seen: 1 reads remaining

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 20 of 89 controls exercised
- 4 test cases: 4 passed, 0 failed, 0 not run

Never exercised:
- button "🔇" — `/`
- generic "D Drowsy Coral #9540 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 4:05..." — `/`
- generic "C Cosmic Tide #5762 confession I pretend to be happy at work every single day, but I haven't felt real joy in m... ⏱️..." — `/`
- generic "W Wistful Dove #7012 regret I got promoted today but I can't tell anyone because my best friend applied for ... ⏱️ 17..." — `/`
- generic "C Cosmic Ash #7698 hope I'm learning to paint in secret. I'm terrible at it but it makes me feel alive f... ⏱️ 3:23 t..." — `/`
- generic "L Luminous Orchid #8425 love I still write letters to my grandmother even though she passed away three years ... 👁️ ..." — `/`
- generic "F Fading Wolf #1889 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 21:53..." — `/`
- generic "S Scarlet Tide #4994 confession Sometimes I drive to the beach at 3am just to scream into the ocean. It's the on... �..." — `/`
- generic "D Distant Orchid #1480 fear I've been applying to jobs in another country without telling my partner. I don'... ⏱️ 5:..." — `/`
- combobox "Burn Mode:" — `/`
- button "Back away" — `/`
- textbox "" — `/`
- button "📋" — `/`
- generic "D Drowsy Coral #9540 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 4:03..." — `/`
- generic "C Cosmic Ash #7698 hope I'm learning to paint in secret. I'm terrible at it but it makes me feel alive f... ⏱️ 3:21 t..." — `/`
- generic "F Fading Wolf #1889 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 21:51..." — `/`
- generic "D Drowsy Coral #9540 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 4:01..." — `/`
- generic "C Cosmic Ash #7698 hope I'm learning to paint in secret. I'm terrible at it but it makes me feel alive f... ⏱️ 3:19 t..." — `/`
- generic "F Fading Wolf #1889 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 21:49..." — `/`
- generic "C Cosmic Ash #7698 hope I'm learning to paint in secret. I'm terrible at it but it makes me feel alive f... ⏱️ 3:13 t..." — `/`
- generic "D Drowsy Coral #9540 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 3:55..." — `/`
- generic "F Fading Wolf #1889 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 21:43..." — `/`
- generic "" — `/`
- generic "×" — `/`
- generic "C Cosmic Ash #7698 hope I'm learning to paint in secret. I'm terrible at it but it makes me feel alive f... ⏱️ 2:45 t..." — `/`
- generic "D Drowsy Coral #9540 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 3:27..." — `/`
- generic "F Fading Wolf #1889 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 21:15..." — `/`
- generic "⚠️ This secret has 1 reads remaining. Reading it brings it closer to burning. Continue? Back away Read it" — `/`
- generic "⚠️" — `/`
- generic "This secret has 1 reads remaining." — `/`
- generic "P Phantom Wolf #9857 love The stranger who smiled at me on the subway this morning made me cry when I got home. I was..." — `/`
- generic "The stranger who smiled at me on the subway this morning made me cry when I got home. I was so touched by simple kind..." — `/`
- generic "× Whisper Your Secret No one will know who you are. Your identity is randomly generated. 52 /500 Mood (optional): con..." — `/`
- generic "Whisper Your Secret" — `/`
- generic "52 /500" — `/`
- generic "P Phantom Wolf #9857 love The stranger who smiled at me on the subway this morning made me cry when I got ... 👁️ 2 r..." — `/`
- generic "C Cosmic Ash #7698 hope I'm learning to paint in secret. I'm terrible at it but it makes me feel alive f... ⏱️ 2:33 t..." — `/`
- generic "D Drowsy Coral #9540 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 3:15..." — `/`
- generic "F Fading Wolf #1889 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 21:03..." — `/`
- generic "× 🕊️ Your secret is now on the wall. You are Distant Ivy #5827 No one can trace this back to you. Whisper ID: 3dfdiz..." — `/`
- generic "Your secret is now on the wall." — `/`
- generic "Direct Link:" — `/`
- generic "Whisper ID: 3dfdiza0 Direct Link: 📋" — `/`
- generic "🕳️ How Tree Hole Works" — `/`
- generic "🎭 Complete Anonymity No login, no tracking. Each post gets a randomly generated identity that cannot be traced back ..." — `/`
- generic "× 🕳️ How Tree Hole Works 🎭 Complete Anonymity No login, no tracking. Each post gets a randomly generated identity t..." — `/`
- generic "C Cosmic Ash #7698 hope I'm learning to paint in secret. I'm terrible at it but it makes me feel alive f... ⏱️ 2:25 t..." — `/`
- generic "D Drowsy Coral #9540 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 3:07..." — `/`
- generic "F Fading Wolf #1889 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 20:55..." — `/`
- generic "H Hollow Panther #2991 confession Sometimes I drive to the beach at 3am just to scream into the ocean. It's the on......" — `/`
- generic "S Shadowed Storm #2846 confession I pretend to be happy at work every single day, but I haven't felt real joy in m......" — `/`
- generic "D Drowsy Ash #4632 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 4:11 t..." — `/`
- generic "S Shadowed Ghost #5904 hope I'm learning to paint in secret. I'm terrible at it but it makes me feel alive f... ⏱️ 3:..." — `/`
- generic "V Velvet Echo #2385 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 21:59..." — `/`
- generic "G Gentle Wind #2258 fear I've been applying to jobs in another country without telling my partner. I don'... ⏱️ 5:59:..." — `/`
- generic "W Wistful Opal #7233 love The stranger who smiled at me on the subway this morning made me cry when I got ... 👁️ 3 r..." — `/`
- generic "F Fading Owl #1348 funny I laugh at my own jokes when I'm alone in my apartment. Full belly laughs. I thi... 👁️ 1 re..." — `/`
- generic "G Glacial Panther #6385 love I still write letters to my grandmother even though she passed away three years ... 👁️ ..." — `/`
- generic "V Velvet Sparrow #4665 regret I got promoted today but I can't tell anyone because my best friend applied for ... ⏱️ ..." — `/`
- generic "D Drowsy Ash #4632 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 4:06 t..." — `/`
- generic "V Velvet Echo #2385 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 21:54..." — `/`
- generic "D Drowsy Ash #4632 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 4:00 t..." — `/`
- generic "V Velvet Echo #2385 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 21:48..." — `/`
- generic "D Drowsy Ash #4632 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 3:54 t..." — `/`
- generic "V Velvet Echo #2385 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 21:42..." — `/`
- generic "D Drowsy Ash #4632 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 3:49 t..." — `/`
- generic "V Velvet Echo #2385 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 21:37..." — `/`
- generic "D Drowsy Ash #4632 hope I've been sober for 100 days and nobody in my life knows I had a problem. This i... ⏱️ 3:43 t..." — `/`
- generic "V Velvet Echo #2385 hope I forgave my father today. He doesn't know it yet. Maybe he never will. But I fe... ⏱️ 21:31..." — `/`

## Session Impressions

**/:** "Filter, sort, share and help dialog work. Reading a secret on its last read shows an empty modal (text never shown) though it burns; Escape does not close modals; confirm dialog says "1 reads remaining"; colour-contrast failure on 8 elements."
**/:** "engine sweep"

## Top Fix

Increase contrast of muted text.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MINOR] `http://localhost:4130/` — Increase contrast of muted text.. Likely in `app/page.tsx`.

After fixing, run `/haunt:haunt-test http://localhost:4130/` again to verify.