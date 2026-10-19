I found one bug. Earlier I mistakenly called the findings tool with an empty list, so please ignore that. The correct result is below.

```json
[
  {
    "description": "The \"Titles Only\" search scope also matches recipe descriptions, so it returns recipes whose titles don't contain the search term. The results banner says \"Found in: N descriptions\".",
    "steps": [
      "Open http://localhost:4107/",
      "Click the \"Titles Only\" filter chip",
      "Type \"garlic\" in the search box",
      "Look at the results and the \"Found in\" banner"
    ],
    "expected_vs_actual": "Expected no results, because no recipe title contains \"garlic\". Actual: 4 recipes (Bruschetta al Pomodoro, Thai Basil Chicken Stir-Fry, Palak Paneer, Hummus) with the banner \"Found in: 4 descriptions\". The same happens with \"chicken\": Coq au Vin is listed even though its title has no \"chicken\". It only has chicken in the description or ingredients."
  }
]
```

I also tested these and they behaved correctly:
- All scope, Ingredients Only, Cuisine and Cooking Method
- Case-insensitive search
- A whitespace-only query
- A query with no matches
- Both sort options
- The Clear button

The only console error was a missing favicon (404), which I didn't count as a bug.
