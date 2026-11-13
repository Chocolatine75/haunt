---
haunt: true
target: http://localhost:4127/
date: 2026-11-12
areas_tested: 2
issues:
  total: 3
  critical: 0
  major: 0
  minor: 3
signals:
  total: 1
  major: 1
  minor: 0
top_fix: "Show a validation message, or disable the button until there is input."
---

# Haunt Report — http://localhost:4127/
2026-11-12 · 2 areas · 3 issues

## Issues

### 1. [MINOR] Clicking Join the Debate with an empty name does nothing and shows no message. Clicking Ask with a blank question also does nothing and shows no message.
- **Page:** `http://localhost:4127/`
- **Fix:** Show a validation message, or disable the button until there is input.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Clicking the button "Join the Debate" changed nothing — `http://localhost:4127/` (step 1)
- **Evidence:** `.haunt-reports/evidence/c44bad47-561c-4836-bf42-bec942ce0020/issue-2` — reproduced 3 of 3 replays (100%)

### 2. [MINOR] The welcome screen has a color-contrast violation.
- **Page:** `http://localhost:4127/`
- **Fix:** Raise the contrast of the flagged element to at least 4.5:1.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Elements must meet minimum color contrast ratio thresholds (1 element) — `http://localhost:4127/` (step 0)
- **Evidence:** `.haunt-reports/evidence/c44bad47-561c-4836-bf42-bec942ce0020/issue-3` — reproduced 3 of 3 replays (100%)

### 3. [MINOR] The Share button gives no feedback when clicked: no copied message and no visible change.
- **Page:** `http://localhost:4127/`
- **Fix:** Show a copied confirmation or a toast after Share.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/c44bad47-561c-4836-bf42-bec942ce0020/issue-4` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] Clicking the button "Ask" changed nothing — `http://localhost:4127/` (step 24)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MAJOR] The same user can upvote the same question repeatedly; clicking the upvote button on a question I just posted took it from 1 to 2 with no toggle or block. (`http://localhost:4127/`)
  - Expected: A second click on the upvote button toggles it off or is ignored, so the count stays at 1 or goes back to 0
  - Seen: The count went from 1 to 2
  - Steps: `.haunt-reports/evidence/c44bad47-561c-4836-bf42-bec942ce0020/issue-1`

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 24 of 79 controls exercised
- 9 test cases: 8 passed, 1 failed, 0 not run

Never exercised:
- button "Cancel" — `/`
- generic "AI Agents" — `/`
- radio "AI Agents" — `/`
- generic "Quantum Computing" — `/`
- generic "Spatial Computing (AR/VR)" — `/`
- radio "Spatial Computing (AR/VR)" — `/`
- generic "Blockchain/Web3" — `/`
- radio "Blockchain/Web3" — `/`
- generic "Biotech/Neurotech" — `/`
- radio "Biotech/Neurotech" — `/`
- generic "Edge Computing" — `/`
- radio "Edge Computing" — `/`
- button "▼ Discussion & Q&A 3" — `/`
- button "▲ 12" — `/`
- button "💬 Reply (2)" — `/`
- button "▲ 8" — `/`
- button "▲ 5" — `/`
- button "▲ 7" — `/`
- button "💬 Reply (1)" — `/`
- button "▲ 4" — `/`
- generic "Rust" — `/`
- generic "Go" — `/`
- generic "TypeScript" — `/`
- generic "Python" — `/`
- generic "Zig" — `/`
- checkbox "Zig" — `/`
- generic "Swift" — `/`
- checkbox "Swift" — `/`
- generic "Kotlin" — `/`
- checkbox "Kotlin" — `/`
- generic "Elixir" — `/`
- checkbox "Elixir" — `/`
- button "▼ Discussion & Q&A 2" — `/`
- button "▲ 9" — `/`
- button "▲ 6" — `/`
- button "▲ 3" — `/`
- generic "GitHub Copilot" — `/`
- radio "GitHub Copilot" — `/`
- generic "Claude" — `/`
- radio "Claude" — `/`
- generic "ChatGPT" — `/`
- generic "Cursor" — `/`
- radio "Cursor" — `/`
- generic "Codeium" — `/`
- radio "Codeium" — `/`
- generic "None — I prefer unassisted coding" — `/`
- radio "None — I prefer unassisted coding" — `/`
- button "▲ 11" — `/`
- generic "D Dana ⚙️" — `/`
- generic "🗳️ Someone just voted on "What's your preferred AI coding assistan..."" — `/`
- button "▲ 2" — `/`
- generic "TechPulse Weekly Tech Debates & Discussions 🌙 A Alex ⚙️" — `/`
- generic "TechPulse" — `/`
- generic "🗳️ Someone just voted on "What will be the most impactful technolo..."" — `/`
- button "☀️" — `/`

## Session Impressions

**/:** "Four issues found: repeated upvoting of the same question, silent empty-name/blank-question submissions, no feedback on Share, and a color-contrast violation on the welcome screen. Main flows only; not every control exercised."
**/:** "engine sweep"

## Top Fix

Show a validation message, or disable the button until there is input.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MINOR] `http://localhost:4127/` — Show a validation message, or disable the button until there is input.. Likely in `app/page.tsx`.
2. [MINOR] `http://localhost:4127/` — Raise the contrast of the flagged element to at least 4.5:1.. Likely in `app/page.tsx`.
3. [MINOR] `http://localhost:4127/` — Show a copied confirmation or a toast after Share.. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4127/` again to verify.