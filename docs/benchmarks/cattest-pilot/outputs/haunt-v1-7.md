```
----------------------------------------
1 areas tested · 3 issues

 [!!] 2 major
  [!] 1 minor

no critical issues

fix first: Give the search input (#search-input) an explicit accessible name (label or aria-label) so it can be found by label, placeholder, or role.

report: .haunt-reports/2026-10-05-confused-beginner.md
----------------------------------------
```

Coverage was shallow. The only route found was `/`, and two of the three steps failed because I couldn't locate the search input. The capture tool returned no accessibility tree, so I guessed field names. The two major issues are those failed lookups, not confirmed app bugs. They are consistent with the input lacking an accessible name, which is the minor issue. The script-tag input, autocomplete, empty results and long text were never exercised. A re-run with the real placeholder text, or after adding a label, would give a better test.
