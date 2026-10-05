```
----------------------------------------
1 areas tested · 1 issues

  [!] 1 minor

no critical issues

fix first: Serve a branded 404 page with a link back to the recipe list for unknown URLs.

report: .haunt-reports/2026-10-05-confused-beginner.md
----------------------------------------
```

The app has a single route, `/`, so only one area was tested. The script-tag and junk text I put in the search box caused no errors or crashes.

I only used 3 of the planned steps, so the sort dropdown and filter buttons were never exercised. I also didn't check the 404 console message on return to `/`. I guessed it was a favicon but never confirmed it.
