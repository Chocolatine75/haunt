----------------------------------------
2 areas tested · 0 issues


no critical issues

report: .haunt-reports/2026-10-06-localhost-4104.md
----------------------------------------

The clean result is weaker than it looks. Coverage was thin:

- **Plan import failed in both testers:** only 14 of 86 controls were exercised, and 3 of the 7 registered cases were not run.
- **Quick View:** one tester saw the buttons do nothing on two cards (Grilled Caesar Salad, Okonomiyaki). The engine couldn't replay it, so it was rejected and isn't in the report. The case that opened Quick View was too weak to catch it. Check it by hand.
- **Unchecked:** keyboard use of the filters, the Highest Rated sort and Quick View dialog behavior (Escape, focus).
- **Count mismatch:** the 30–60 min time filter says "Showing 27 recipes" but only 15 cards were in the page. This may just be infinite scroll, but nobody verified it.
- **One failed check:** "cuisine-filter" is listed under "To check by hand". The tester's own assertion was wrong, since the hidden menu still contains "Mexican", and the Italian filter itself worked.
