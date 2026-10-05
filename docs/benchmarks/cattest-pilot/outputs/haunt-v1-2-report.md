---
haunt: true
target: http://localhost:4102/
date: 2026-10-05
personas: [confused-beginner]
areas_tested: 1
issues:
  total: 2
  critical: 0
  major: 0
  minor: 2
top_fix: "Serve a custom styled 404 page with the site header and a link back to the home page."
---

# Haunt Report — http://localhost:4102/
2026-10-05 · 1 areas · 2 issues · confused-beginner

## Issues

### 1. [MINOR] Unknown URLs (e.g. /admin) show the default unstyled server 404 page ('Error response / File not found') with no link back to the gallery or site branding
- **Page:** `http://localhost:4102/admin`
- **Fix:** Serve a custom styled 404 page with the site header and a link back to the home page.

### 2. [MINOR] Clicking a gallery item gave no observable change in URL (no deep link per photo), so back button and sharing a specific photo are not supported
- **Page:** `http://localhost:4102/`
- **Fix:** Update the URL hash (e.g. #photo-0) when a photo is opened so it can be shared and closed with the back button.

## Session Impressions

**/ — confused-beginner:** "A static single-page gallery with little to break. Gallery items are keyboard-focusable and labelled, and no forms exist. The only rough edges are the unstyled default 404 page and a 404 console error for a missing resource on the home page (probably a favicon)."

## Top Fix

Serve a custom styled 404 page with the site header and a link back to the home page.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MINOR] `http://localhost:4102/admin` — Configure the server to return a custom styled 404 page with the site header and a link back to the home page.
2. [MINOR] `http://localhost:4102/` — Update the URL hash (e.g. #photo-0) when a gallery photo is opened so it can be shared and closed with the back button.

After fixing, run `/haunt:haunt-test http://localhost:4102/` again to verify.
