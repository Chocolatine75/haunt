---
haunt: true
target: http://localhost:4107/
date: 2026-10-05
personas: [confused-beginner]
areas_tested: 1
issues:
  total: 3
  critical: 0
  major: 2
  minor: 1
top_fix: "Give the search input (#search-input) an explicit accessible name (label or aria-label) so it can be found by label, placeholder, or role."
---

# Haunt Report — http://localhost:4107/
2026-10-05 · 1 areas · 3 issues · confused-beginner

## Issues

### 1. [MAJOR] Search input could not be located by id, label, placeholder, or role "search-input" (fill timed out after 30s)
- **Page:** `http://localhost:4107/`
- **Fix:** Add a `<label for="search-input">` or `aria-label="Search recipes"` and a descriptive placeholder to `#search-input`.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing; the page looks like a single static HTML file, so framework is unclear)*

### 2. [MAJOR] Targeting the field as "Search" resolved to the `role="search"` container div instead of the input
- **Page:** `http://localhost:4107/`
- **Fix:** Rename the container's `aria-label` (currently "Recipe search") or give the input its own distinct accessible name so assistive tech and label lookups reach the textbox.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*

### 3. [MINOR] Search input lacks an explicit accessible name
- **Page:** `http://localhost:4107/`
- **Fix:** Give `#search-input` a `<label for="search-input">` or `aria-label` such as "Search recipes".
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*

## Session Impressions

**/ — confused-beginner:** "Single-page recipe search. Step budget was mostly spent locating the search input; only one junk-input attempt succeeded and no crash or console errors were seen. Coverage was shallow."

Caveat: issues 1 and 2 are failed locator attempts that may partly reflect the tester guessing the wrong field name (the capture tool returned no accessibility tree). They are consistent with the input missing an accessible name (issue 3). The XSS-style input and result behavior (autocomplete, empty results, long text) were not actually exercised.

## Top Fix

Give the search input (#search-input) an explicit accessible name (label or aria-label) so it can be found by label, placeholder, or role.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4107/` — Add a `<label for="search-input">` or `aria-label="Search recipes"` and a placeholder to `#search-input`. Likely in `app/page.tsx`.
2. [MAJOR] `http://localhost:4107/` — Ensure the `role="search"` container's label doesn't collide with the input's name; give the input its own distinct accessible name. Likely in `app/page.tsx`.
3. [MINOR] `http://localhost:4107/` — Add an explicit accessible name to `#search-input` via label or aria-label. Likely in `app/page.tsx`.

After fixing, run `/haunt:haunt-test http://localhost:4107/` again to verify.
