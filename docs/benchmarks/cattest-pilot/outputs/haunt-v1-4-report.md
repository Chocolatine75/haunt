---
haunt: true
target: http://localhost:4104/
date: 2026-10-05
personas: [confused-beginner]
areas_tested: 1
issues:
  total: 1
  critical: 0
  major: 0
  minor: 1
top_fix: "Serve a branded 404 page with a link back to the recipe list for unknown URLs."
---

# Haunt Report — http://localhost:4104/
2026-10-05 · 1 areas · 1 issues · confused-beginner

## Issues

### 1. [MINOR] Unknown URL (/recipe/999) returns the default Python http.server 'Error response' page with no branding or link back to the app
- **Page:** `http://localhost:4104/recipe/999`
- **Fix:** Serve a branded 404 page with a link back to the recipe list, or fall back to index.html for unknown routes.

## Session Impressions

**/ — confused-beginner:** "Single-page recipe app. Junk and script input in search caused no errors or crashes. Unknown URLs show a bare default server error page. Page console shows a 404 resource load on return to root (likely favicon)."

## Top Fix

Serve a branded 404 page with a link back to the recipe list for unknown URLs.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MINOR] `http://localhost:4104/recipe/999` — Serve a branded 404 page (or fall back to index.html) for unknown routes instead of the default http.server error page.

After fixing, run `/haunt:haunt-test http://localhost:4104/` again to verify.
