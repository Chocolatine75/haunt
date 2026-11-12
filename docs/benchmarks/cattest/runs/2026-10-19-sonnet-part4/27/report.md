---
haunt: true
target: http://localhost:4127/
date: 2026-10-19
areas_tested: 2
issues:
  total: 4
  critical: 0
  major: 0
  minor: 4
signals:
  total: 1
  major: 1
  minor: 0
top_fix: "Show a confirmation toast or fallback when sharing"
---

# Haunt Report — http://localhost:4127/
2026-10-19 · 2 areas · 4 issues

## Issues

### 1. [MINOR] Clicking Share gives no visible feedback (no copied/shared message)
- **Page:** `http://localhost:4127/`
- **Fix:** Show a confirmation toast or fallback when sharing
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/f2996299-9d53-4a14-9736-25b872bf9fcc/issue-1` — reproduced 3 of 3 replays (100%)

### 2. [MINOR] Join the Debate with empty name does nothing, no validation message
- **Page:** `http://localhost:4127/`
- **Fix:** Show an error for empty name
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Clicking the button "Join the Debate" changed nothing — `http://localhost:4127/` (step 1)
- **Evidence:** `.haunt-reports/evidence/f2996299-9d53-4a14-9736-25b872bf9fcc/issue-2` — reproduced 3 of 3 replays (100%)

### 3. [MINOR] Ask with empty question does nothing, no feedback
- **Page:** `http://localhost:4127/`
- **Fix:** Show validation message
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Clicking the button "Ask" changed nothing — `http://localhost:4127/` (step 29)
- **Evidence:** `.haunt-reports/evidence/f2996299-9d53-4a14-9736-25b872bf9fcc/issue-3` — reproduced 3 of 3 replays (100%)

### 4. [MINOR] The same user can upvote the same question repeatedly (12 -> 13 -> 14); no one-vote-per-user or toggle
- **Page:** `http://localhost:4127/`
- **Fix:** Limit to one upvote per user, with toggle
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/f2996299-9d53-4a14-9736-25b872bf9fcc/issue-4` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] Elements must meet minimum color contrast ratio thresholds (1 element) — `http://localhost:4127/` (step 0)

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 23 of 79 controls exercised
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
- button "▲ 8" — `/`
- button "▲ 5" — `/`
- button "▲ 7" — `/`
- button "💬 Reply (1)" — `/`
- button "▲ 4" — `/`
- button "💬 Reply (0)" — `/`
- generic "Rust" — `/`
- generic "Go" — `/`
- generic "TypeScript" — `/`
- generic "Python" — `/`
- checkbox "Python" — `/`
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
- generic "ChatGPT" — `/`
- radio "ChatGPT" — `/`
- generic "Cursor" — `/`
- radio "Cursor" — `/`
- generic "Codeium" — `/`
- radio "Codeium" — `/`
- generic "None — I prefer unassisted coding" — `/`
- radio "None — I prefer unassisted coding" — `/`
- button "▲ 11" — `/`
- button "▲ 0" — `/`
- generic "ML Maria Lopez ⚙️" — `/`
- generic "Change Display Name Cancel Update" — `/`
- generic "🗳️ Someone just voted on "What's your preferred AI coding assistan..."" — `/`
- generic "TechPulse Weekly Tech Debates & Discussions 🌙 ML Maria L ⚙️" — `/`
- button "💬 Reply (3)" — `/`
- button "▲ 14" — `/`
- button "☀️" — `/`

## Session Impressions

**/:** "Four minor issues: empty name on Join the Debate and empty question on Ask give no message, Share gives no feedback, and the same user can upvote a question repeatedly. Polls, votes, sorting, replies, renaming and theme toggle worked."
**/:** "engine sweep"

## Top Fix

Show a confirmation toast or fallback when sharing

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MINOR] `http://localhost:4127/` — Show a confirmation toast or fallback when sharing. Likely in `app/page.tsx`.
2. [MINOR] `http://localhost:4127/` — Show an error for empty name. Likely in `app/page.tsx`.
3. [MINOR] `http://localhost:4127/` — Show validation message. Likely in `app/page.tsx`.
4. [MINOR] `http://localhost:4127/` — Limit to one upvote per user, with toggle. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4127/` again to verify.