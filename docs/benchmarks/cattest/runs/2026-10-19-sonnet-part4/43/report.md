---
haunt: true
target: http://localhost:4143/
date: 2026-10-19
areas_tested: 2
issues:
  total: 1
  critical: 0
  major: 1
  minor: 0
signals:
  total: 2
  major: 1
  minor: 1
top_fix: "Darken the button background or text."
---

# Haunt Report — http://localhost:4143/
2026-10-19 · 2 areas · 1 issues

## Issues

### 1. [MAJOR] Begin Your Journey button has insufficient color contrast (white on gold).
- **Page:** `http://localhost:4143/`
- **Fix:** Darken the button background or text.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Elements must meet minimum color contrast ratio thresholds (1 element) — `http://localhost:4143/` (step 0)
- **Evidence:** `.haunt-reports/evidence/c64f9b5c-f0ab-4185-84f4-ff81530c78f5/issue-2` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] GET /video-files/3571264/3571264-uhd_2560_1440_30fps.mp4 has had no answer for 12.8 s — `http://localhost:4143/` (step 0, 2 times)
- [MINOR] GET /video-files/857251/857251-hd_1920_1080_25fps.mp4 answered 403 — `http://localhost:4143/` (steps 0, 1, 3 times)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MINOR] Download Expedition Guide button does nothing visible (no download, no feedback). (`http://localhost:4143/`)
  - Expected: A download or feedback after clicking
  - Seen: No change at all
  - Steps: `.haunt-reports/evidence/c64f9b5c-f0ab-4185-84f4-ff81530c78f5/issue-1`

Checks that failed, and that no issue was filed for:
- "valid-submit" on `/` — expected: Valid submit shows confirmation text
- "esc" on `/` — expected: Escape closes modal

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 13 of 17 controls exercised
- 4 test cases: 2 passed, 2 failed, 0 not run

Never exercised:
- button "Close modal" — `/`
- textbox "Phone (Optional)" — `/`
- dialog "Book Your Consultation" — `/`
- generic "× Book Your Consultation Complete the form below and our expedition team will reach out within 24 hours. Full Name * ..." — `/`

## Session Impressions

**/:** "Booking modal, validation, Escape and nav dots work. Found a colour-contrast failure on 'Begin Your Journey' and a 'Download Expedition Guide' button that does nothing visible; third-party video requests returned 403 or hung."
**/:** "engine sweep"

## Top Fix

Darken the button background or text.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4143/` — Darken the button background or text.. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4143/` again to verify.