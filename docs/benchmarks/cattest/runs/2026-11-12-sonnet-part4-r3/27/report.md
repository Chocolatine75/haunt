---
haunt: true
target: http://localhost:4127/
date: 2026-11-12
areas_tested: 2
issues:
  total: 3
  critical: 0
  major: 1
  minor: 2
signals:
  total: 1
  major: 1
  minor: 0
top_fix: "Block or disable a 4th selection"
---

# Haunt Report — http://localhost:4127/
2026-11-12 · 2 areas · 3 issues

## Issues

### 1. [MAJOR] Multi-choice poll says 'pick up to 3' but a 4th option can be checked; counter stays 3/3
- **Page:** `http://localhost:4127/`
- **Fix:** Block or disable a 4th selection
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/bfe0449d-363a-4e53-9e2e-cee02d032f3a/issue-1` — reproduced 3 of 3 replays (100%)

### 2. [MINOR] Updating display name with blank input does nothing and gives no error message
- **Page:** `http://localhost:4127/`
- **Fix:** Show validation message
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Clicking the button "Update" changed nothing — `http://localhost:4127/` (step 17)
- **Evidence:** `.haunt-reports/evidence/bfe0449d-363a-4e53-9e2e-cee02d032f3a/issue-2` — reproduced 3 of 3 replays (100%)

### 3. [MINOR] Share button gives no visible feedback when clicked
- **Page:** `http://localhost:4127/`
- **Fix:** Show a copied confirmation
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/bfe0449d-363a-4e53-9e2e-cee02d032f3a/issue-3` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] Elements must meet minimum color contrast ratio thresholds (1 element) — `http://localhost:4127/` (step 0)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

Checks that failed, and that no issue was filed for:
- "ask" on `/` — expected: Question appears and count becomes 3

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 18 of 72 controls exercised
- 4 test cases: 1 passed, 3 failed, 0 not run

Never exercised:
- button "Cancel" — `/`
- generic "AI Agents" — `/`
- generic "Quantum Computing" — `/`
- radio "Quantum Computing" — `/`
- generic "Spatial Computing (AR/VR)" — `/`
- radio "Spatial Computing (AR/VR)" — `/`
- generic "Blockchain/Web3" — `/`
- radio "Blockchain/Web3" — `/`
- generic "Biotech/Neurotech" — `/`
- radio "Biotech/Neurotech" — `/`
- generic "Edge Computing" — `/`
- radio "Edge Computing" — `/`
- button "Most Upvoted" — `/`
- button "▲ 12" — `/`
- button "💬 Reply (2)" — `/`
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
- radio "ChatGPT" — `/`
- generic "Cursor" — `/`
- radio "Cursor" — `/`
- generic "Codeium" — `/`
- radio "Codeium" — `/`
- generic "None — I prefer unassisted coding" — `/`
- radio "None — I prefer unassisted coding" — `/`
- button "▲ 0" — `/`
- generic "TechPulse Weekly Tech Debates & Discussions 🌙 SL Sam Lee ⚙️" — `/`
- generic "Change Display Name Cancel Update" — `/`
- generic "TechPulse" — `/`
- button "☀️" — `/`

## Session Impressions

**/:** "Three issues found: multi-choice poll allows a 4th selection despite a limit of 3, blank display-name Update gives no feedback, and Share gives no visible confirmation. Voting, totals, adding questions, upvoting and valid rename worked."
**/:** "engine sweep"

## Top Fix

Block or disable a 4th selection

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4127/` — Block or disable a 4th selection. Likely in `app/page.tsx`.
2. [MINOR] `http://localhost:4127/` — Show validation message. Likely in `app/page.tsx`.
3. [MINOR] `http://localhost:4127/` — Show a copied confirmation. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4127/` again to verify.