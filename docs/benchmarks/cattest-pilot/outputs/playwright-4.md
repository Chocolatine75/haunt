```json
[
  {
    "description": "Quick View button on a recipe card does nothing. Clicking it (or the card itself) opens no modal, detail view or navigation, and no console error appears.",
    "steps": "1. Open http://localhost:4104/ and wait for the cards to load. 2. Hover any recipe card so the 'Quick View' button appears over the image. 3. Click 'Quick View'. 4. Click the card title or body as well.",
    "expected_vs_actual": "Expected: a quick-view panel or modal with the recipe details (ingredients, etc.). Actual: nothing happens."
  },
  {
    "description": "Some recipes are listed under the wrong cuisine. 'Korean Fried Chicken' and 'Beef Bulgogi' are Korean dishes, but both are labelled Japanese and show up under the Japanese cuisine filter. The Cuisine filter has no Korean option.",
    "steps": "1. Open the app. 2. Scroll to 'Korean Fried Chicken' (or 'Beef Bulgogi'), or open Cuisine and pick Japanese. 3. Look at the cuisine label on the card.",
    "expected_vs_actual": "Expected: the cuisine label matches the dish (Korean). Actual: it shows 'JAPANESE'."
  },
  {
    "description": "Selecting several Dietary chips returns recipes that match any chip (OR), not all of them. Vegan + Keto lists vegan-only recipes that are not keto, such as Falafel Wrap and Chana Masala, and keto-only recipes that are not vegan, such as Cobb Salad. Users narrowing by diet expect every selected restriction to apply, so these results are wrong for them. This may be intended behaviour, so treat it as lower confidence.",
    "steps": "1. Open Dietary and click 'Vegan'. 2. Click 'Keto' too. 3. Look at the results.",
    "expected_vs_actual": "Expected: only recipes tagged both Vegan and Keto, such as Cauliflower Steak and Guacamole. Actual: 21 recipes, including ones with only one of the two tags."
  },
  {
    "description": "Time filter ranges overlap at the boundaries. A 120-minute recipe (Matcha Green Tea Cheesecake) appears under '2+ hours', and 60-minute recipes appear under both '30-60 min' and '1-2 hours'. This is low severity and may be intended.",
    "steps": "1. Open Time and click '2+ hours'. 2. Look at the Matcha Green Tea Cheesecake card (120m). 3. Clear it and click '1-2 hours'; the same card is listed there too.",
    "expected_vs_actual": "Expected: each recipe falls in exactly one time bucket. Actual: 120m shows under both '1-2 hours' and '2+ hours'."
  },
  {
    "description": "Filter dropdowns stay open after a chip is picked, and the open Time panel covers the result cards until the user clicks elsewhere. This is minor UX.",
    "steps": "1. Click 'Time'. 2. Click '2+ hours'. 3. Look at the screen.",
    "expected_vs_actual": "Expected: the dropdown closes after selection, or at least does not cover results. Actual: the panel stays open and overlaps the first row of cards."
  }
]
```

I only found these through the UI. I didn't see any other visible failures, and search, sorting, infinite scroll, and the Difficulty filter behaved correctly.
