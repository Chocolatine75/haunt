---
haunt: true
target: http://localhost:4143/
date: 2026-11-13
areas_tested: 2
issues:
  total: 2
  critical: 0
  major: 0
  minor: 2
signals:
  total: 0
  major: 0
  minor: 0
top_fix: "Raise contrast to 4.5:1."
---

# Haunt Report — http://localhost:4143/
2026-11-13 · 2 areas · 2 issues

## Issues

### 1. [MINOR] Begin Your Journey link has insufficient color contrast.
- **Page:** `http://localhost:4143/`
- **Fix:** Raise contrast to 4.5:1.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Elements must meet minimum color contrast ratio thresholds (1 element) — `http://localhost:4143/` (step 0)
- **Evidence:** `.haunt-reports/evidence/a19a989a-6da1-4990-b484-e6b81af5262b/issue-2` — reproduced 3 of 3 replays (100%)

### 2. [MINOR] Hero background video from pexels returns 404.
- **Page:** `http://localhost:4143/`
- **Fix:** Replace the video URL and add a poster fallback.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MINOR] GET /video-files/857251/857251-hd_1920_1080_25fps.mp4 answered 404 — `http://localhost:4143/` (steps 0, 1, 3 times)
- **Evidence:** `.haunt-reports/evidence/a19a989a-6da1-4990-b484-e6b81af5262b/issue-3` — reproduced 3 of 3 replays (100%)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MAJOR] Download Expedition Guide button does nothing when clicked: no download, dialog, or message. (`http://localhost:4143/`)
  - Expected: A download starts or a form or message appears
  - Seen: No change at all after click
  - Steps: `.haunt-reports/evidence/a19a989a-6da1-4990-b484-e6b81af5262b/issue-1`

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 12 of 17 controls exercised
- 2 test cases: 2 passed, 0 failed, 0 not run

Never exercised:
- link "Begin Your Journey" — `/`
- button "Close modal" — `/`
- textbox "Phone (Optional)" — `/`
- dialog "Book Your Consultation" — `/`
- generic "× Book Your Consultation Complete the form below and our expedition team will reach out within 24 hours. Full Name * ..." — `/`

## Session Impressions

**/:** "Booking modal works (validation, success message, Escape to close) and section nav works. Download Expedition Guide button is dead with no feedback. Begin Your Journey link fails colour contrast. Hero background video returns 404."
**/:** "engine sweep"

## Top Fix

Raise contrast to 4.5:1.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MINOR] `http://localhost:4143/` — Raise contrast to 4.5:1.. Likely in `app/page.tsx`.
2. [MINOR] `http://localhost:4143/` — Replace the video URL and add a poster fallback.. Likely in `app/page.tsx`.

After fixing, run `/haunt:haunt-test http://localhost:4143/` again to verify.