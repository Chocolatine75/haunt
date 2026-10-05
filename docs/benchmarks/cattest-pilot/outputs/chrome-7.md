```json
[
  {
    "description": "The \"Titles Only\" search mode also matches recipe descriptions, not just titles. It returns recipes whose titles don't contain the query.",
    "steps": "1. Open http://localhost:4107/\n2. Type \"grilled\" in the search box\n3. Click the \"Titles Only\" chip\n4. Look at the results. (Typing \"Italian\" in the same mode gives a similar result.)",
    "expected_vs_actual": "Expected: only recipes with \"grilled\" in the title, such as Grilled Lamb Kebabs. Actual: 4 recipes are returned, including Chicken Tacos al Pastor, Elote Mexican Street Corn and Croque Monsieur, whose titles don't contain \"grilled\". With \"Italian\", Titles Only returns Chicken Parmesan, which has no \"Italian\" in its title. Its description does say \"Italian-American\". Titles Only and All therefore behave much alike, so the filter doesn't isolate title matches."
  }
]
```

I tested search, the five filter chips and the three sort options. I did this by setting input values and clicking through script, with only a couple of screenshots. I didn't open any recipe detail views or check layout at other window sizes.

Other behavior looked correct:
- Prep Time sort ran from 10 to 300 minutes.
- Difficulty sort ran Easy, then Medium, then Hard.
- Searches were case-insensitive.
- Searches with no matches showed the "No recipes found" empty state.
