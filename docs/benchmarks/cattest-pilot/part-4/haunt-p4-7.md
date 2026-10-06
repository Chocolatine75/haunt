The run found two major issues on `http://localhost:4107/`, and both reproduced 3 of 3 times on replay. Scouting found no links on the page, so the only area tested was `/`. The report is at `.haunt-reports/2026-10-05-localhost-4107.md`.

1. **Titles Only filter:** With "chicken" typed and Titles Only on, Coq au Vin still appears even though its title has no "chicken". The results summary reads "Found in: 7 titles, 8 descriptions", so the filter drops ingredient matches but still matches descriptions.
2. **Color contrast:** The axe audit flags 31 elements on the home page for insufficient color contrast.

Other things the testers checked:
- **Working:** Sort by prep time and by difficulty reorders correctly, and the choice persists across searches. Basic search, case-insensitive search, Ingredients Only, clearing the search, and keyboard use of search and filters all worked.
- **Not confirmed:** The Titles Only button may not report a pressed state, and the suggestion dropdown may block the scope buttons while it's open. The replay rejected both claims, so neither is in the report.
- **Test cases:** The report counts 4 of 7 test cases as failed. The testers say two of those failures came from their own wrong expectations, so only the Titles Only failure is a real finding.
- **Coverage:** 8 of 17 listed controls were exercised. The unexercised ones are mostly the search suggestion options.
