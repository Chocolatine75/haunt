The run reported 0 issues, but that result leaves out a likely bug and some untested ground.

**Quick View may be dead.** The tester clicked it, hovered then clicked, and pressed Enter and Space. Nothing happened each time. No dialog appeared, the page didn't change, and the console showed no errors. The tester filed the issue without a signal or an observation, so the engine rejected it. The report therefore doesn't list it. It only played 7 of its 40 actions and tried one card. Treat this as unconfirmed and check it by hand.

**Report coverage and cases:**
- **Coverage:** 16 of 101 controls were exercised.
- **Cases:** The report counts 9 test cases, 5 passed and 4 failed. It lists no issues for those 4 failures, and I didn't investigate why.
- **Planner cases:** The planner's cases didn't register in the Quick View session because the plan call failed on ambiguous "Quick View" buttons.

**Filters and search:**
- **Search, sort and filters:** The tester for search, empty state, combined filters and sort found nothing wrong. The filters tester found nothing wrong either.
- **Not played:** Longest Cook Time, Easiest First, Hardest First and Trending sorts, plus several filter options, were not played.
- **Back to top:** It works.
- **Mislabelled data:** Beef Bulgogi and Korean Fried Chicken are labelled Japanese. This is a data quirk the tester noted, not an issue in the report.

The full report is at `.haunt-reports/2026-10-05-localhost-4104.md`.
