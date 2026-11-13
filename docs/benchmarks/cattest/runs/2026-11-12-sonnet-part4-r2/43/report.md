---
haunt: true
target: http://localhost:4143/
date: 2026-11-12
areas_tested: 2
issues:
  total: 2
  critical: 0
  major: 1
  minor: 1
signals:
  total: 6
  major: 6
  minor: 0
top_fix: "Increase text/background contrast."
---

# Haunt Report — http://localhost:4143/
2026-11-12 · 2 areas · 2 issues

## Issues

### 1. [MAJOR] Color contrast failure on the hero CTA 'Begin Your Journey'
- **Page:** `http://localhost:4143/`
- **Fix:** Increase text/background contrast.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MAJOR] Elements must meet minimum color contrast ratio thresholds (1 element) — `http://localhost:4143/` (step 0)
- **Evidence:** `.haunt-reports/evidence/76366622-dc30-4f14-8806-9e56d46235a1/issue-1` — reproduced 3 of 3 replays (100%)

### 2. [MINOR] Background videos from pexels return 404 or hang with no answer
- **Page:** `http://localhost:4143/`
- **Fix:** Fix video URLs and provide poster fallbacks.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Detected:** [MINOR] GET /video-files/857251/857251-hd_1920_1080_25fps.mp4 answered 404 — `http://localhost:4143/` (steps 0, 1, 3 times)
- **Evidence:** `.haunt-reports/evidence/76366622-dc30-4f14-8806-9e56d46235a1/issue-2` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] GET /video-files/855029/855029-hd_1920_1080_30fps.mp4 has had no answer for 14.2 s — `http://localhost:4143/` (steps 0, 4, 8, 10, 12, 5 times)
- [MAJOR] GET /video-files/1093662/1093662-hd_1920_1080_30fps.mp4 has had no answer for 14.2 s — `http://localhost:4143/` (steps 0, 4, 8, 10, 12, 5 times)
- [MAJOR] GET /video-files/3571264/3571264-uhd_2560_1440_30fps.mp4 has had no answer for 14.2 s — `http://localhost:4143/` (steps 0, 4, 8, 10, 12, 5 times)
- [MAJOR] GET /video-files/1093665/1093665-hd_1920_1080_30fps.mp4 has had no answer for 18.5 s — `http://localhost:4143/` (steps 1, 8, 12, 4 times)
- [MAJOR] GET /video-files/857251/857251-hd_1920_1080_25fps.mp4 has had no answer for 11.0 s — `http://localhost:4143/` (steps 4, 8, 2 times)
- [MAJOR] GET /s/cormorantgaramond/v21/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYqXtKky2F7g.woff2 has had no answer for 10.4 s — `http://localhost:4143/` (steps 4, 8, 2 times)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

Checks that failed, and that no issue was filed for:
- "esc" on `/` — expected: Escape closes modal

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 11 of 17 controls exercised
- 3 test cases: 2 passed, 1 failed, 0 not run

Never exercised:
- button "Go to Hero section" — `/`
- link "Begin Your Journey" — `/`
- button "Close modal" — `/`
- textbox "Phone (Optional)" — `/`
- dialog "Book Your Consultation" — `/`
- generic "× Book Your Consultation Complete the form below and our expedition team will reach out within 24 hours. Full Name * ..." — `/`

## Session Impressions

**/:** "Hero button fails colour contrast; background videos 404 or never answer. Booking modal works (validation, thank-you, Escape closes)."
**/:** "engine sweep"

## Top Fix

Increase text/background contrast.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4143/` — Increase text/background contrast.. Likely in `app/page.tsx`.
2. [MINOR] `http://localhost:4143/` — Fix video URLs and provide poster fallbacks.. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4143/` again to verify.