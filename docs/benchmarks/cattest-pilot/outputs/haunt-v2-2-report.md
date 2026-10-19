---
haunt: true
target: http://localhost:4102/
date: 2026-10-05
personas: [confused-beginner]
areas_tested: 1
issues:
  total: 0
  critical: 0
  major: 0
  minor: 0
signals:
  total: 0
  major: 0
  minor: 0
top_fix: ""
---

# Haunt Report — http://localhost:4102/
2026-10-05 · 1 areas · 0 issues · confused-beginner

## Issues

_No issues found._

## Session Impressions

**/ — Confused Beginner:** "Completed 13 steps across 4 pages."

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

_No issues found._

After fixing, run `/haunt:haunt-test http://localhost:4102/` again to verify.

## Sandbox-Blocked Requests

These are not app bugs — the test sandbox blocked an attempt to reach an origin outside the target app, shown here for visibility into what the persona tried.

- GET https://picsum.photos/seed/lion1/400/300 -> https://fastly.picsum.photos/id/500/400/300.jpg (cross-origin redirect)