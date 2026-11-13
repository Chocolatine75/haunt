---
haunt: true
target: http://localhost:4104/
date: 2026-11-12
areas_tested: 2
issues:
  total: 1
  critical: 0
  major: 1
  minor: 0
signals:
  total: 3
  major: 2
  minor: 1
top_fix: "Wire the Quick View button to open the recipe preview."
---

# Haunt Report — http://localhost:4104/
2026-11-12 · 2 areas · 1 issues

## Issues

### 1. [MAJOR] Quick View button on recipe cards does nothing when clicked or activated with Enter (no dialog, no change).
- **Page:** `http://localhost:4104/`
- **Fix:** Wire the Quick View button to open the recipe preview.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/3dbef0bf-00df-4964-90b6-1ca1f0bd01c4/issue-1` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] The generic "🍽 🥄 11 ingredients ⏱ 40 min Medium Quick View Thai Green Curry with Tofu Fragrant green curry paste simmered in coc..." is covered by the generic "🥄 13 ingredients": a click on it lands on what covers it — `http://localhost:4104/` (step 12)
- [MAJOR] The button "⏱️ Time" is covered by the generic "Easy": a click on it lands on what covers it — `http://localhost:4104/` (step 26)
- [MINOR] The page is 887 px wider than the window (375 px): it scrolls sideways — `http://localhost:4104/` (step 26)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MINOR] Korean dishes (Beef Bulgogi, Korean Fried Chicken) are categorised as Japanese cuisine and appear under the Japanese filter. (`http://localhost:4104/`)
  - Expected: Korean dishes not listed under Japanese
  - Seen: Both appear under Cuisine: Japanese
  - Steps: `.haunt-reports/evidence/3dbef0bf-00df-4964-90b6-1ca1f0bd01c4/issue-2`

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 13 of 78 controls exercised
- 5 test cases: 4 passed, 1 failed, 0 not run

Never exercised:
- generic "Italian" — `/`
- generic "Mexican" — `/`
- generic "Indian" — `/`
- generic "French" — `/`
- generic "Thai" — `/`
- generic "American" — `/`
- generic "Mediterranean" — `/`
- generic "Vegetarian" — `/`
- generic "Gluten-Free" — `/`
- generic "Dairy-Free" — `/`
- generic "Keto" — `/`
- generic "Paleo" — `/`
- generic "Medium" — `/`
- generic "Hard" — `/`
- generic "30-60 min" — `/`
- generic "1-2 hours" — `/`
- generic "2+ hours" — `/`
- generic "🍽 🥄 11 ingredients ⏱ 30 min Medium Quick View Japanese Okonomiyaki Japanese savory pancake with cabbage, seafood, t..." — `/`
- generic "🍽 🥄 13 ingredients ⏱ 80 min Medium Quick View Thai Massaman Curry Rich and mild curry with tender beef, potatoes, p..." — `/`
- generic "🍽 🥄 6 ingredients ⏱ 20 min Easy Quick View Mexican Elote (Mexican Street Corn) Grilled corn on the cob slathered wi..." — `/`
- generic "🍽 🥄 14 ingredients ⏱ 150 min Hard Quick View Mediterranean Lamb Tagine Slow-cooked lamb with dried apricots, almond..." — `/`
- generic "🍽 🥄 13 ingredients ⏱ 120 min Hard Quick View French Coq au Vin Chicken braised in Burgundy wine with lardons, mushr..." — `/`
- generic "🍽 🥄 11 ingredients ⏱ 55 min Medium Quick View Mexican Chicken Enchiladas Verdes Corn tortillas filled with shredded..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 75 min Medium Quick View French Ratatouille Thinly sliced vegetables arranged in a spiral, slow..." — `/`
- generic "🍽 🥄 4 ingredients ⏱ 15 min Medium Quick View Japanese Tamagoyaki Sweet Japanese rolled omelette with dashi, careful..." — `/`
- generic "🍽 🥄 11 ingredients ⏱ 30 min Medium Quick View Thai Tom Yum Goong Spicy and sour shrimp soup with lemongrass, galang..." — `/`
- generic "🍽 🥄 8 ingredients ⏱ 40 min Easy Quick View American Loaded Sweet Potato Fries Crispy sweet potato fries topped with..." — `/`
- generic "🍽 🥄 13 ingredients ⏱ 35 min Medium Quick View Mexican Fish Tacos with Mango Salsa Crispy beer-battered fish with tr..." — `/`
- generic "🍽 🥄 14 ingredients ⏱ 100 min Hard Quick View Mediterranean Greek Moussaka Layered eggplant, spiced lamb, and creamy..." — `/`
- generic "🍽 🥄 5 ingredients ⏱ 25 min Medium Quick View Italian Carbonara Spaghetti with crispy guanciale, egg yolk, Pecorino ..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 120 min Hard Quick View Japanese Matcha Green Tea Cheesecake Creamy Japanese-style cheesecake i..." — `/`
- generic "🍽 🥄 10 ingredients ⏱ 40 min Medium Quick View Indian Palak Paneer Cubes of paneer cheese in a smooth spinach gravy ..." — `/`
- button "Back to top" — `/`
- generic "×" — `/`
- generic "🍽 🥄 10 ingredients ⏱ 20 min Easy Quick View Japanese Spicy Tuna Poke Bowl Fresh ahi tuna cubes in spicy mayo and so..." — `/`
- generic "🍽 🥄 8 ingredients ⏱ 35 min Medium Quick View Japanese Vegetable Tempura Lightly battered seasonal vegetables deep-f..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 45 min Medium Quick View Japanese Sushi Hand Rolls Crispy nori wrapped around seasoned sushi ri..." — `/`
- generic "🍽 🥄 5 ingredients ⏱ 25 min Easy Quick View Japanese Miso Glazed Salmon Salmon fillet marinated in sweet white miso,..." — `/`
- generic "🍽 🥄 15 ingredients ⏱ 160 min Hard Quick View Japanese Tonkotsu Ramen Rich pork bone broth simmered for hours, serve..." — `/`
- generic "🍽 🥄 11 ingredients ⏱ 50 min Medium Quick View Japanese Korean Fried Chicken Double-fried chicken wings coated in sw..." — `/`
- generic "🍽 🥄 11 ingredients ⏱ 40 min Medium Quick View Thai Green Curry with Tofu Fragrant green curry paste simmered in coc..." — `/`
- generic "🍽 🥄 6 ingredients ⏱ 15 min Easy Quick View American Acai Bowl Thick blended acai topped with granola, fresh berries..." — `/`
- generic "🍽 🥄 5 ingredients ⏱ 15 min Easy Quick View Italian Caprese Salad Stack Layered fresh mozzarella, heirloom tomatoes,..." — `/`
- generic "🍽 🥄 10 ingredients ⏱ 25 min Easy Quick View American Cobb Salad Rows of grilled chicken, bacon, avocado, egg, blue ..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 20 min Easy Quick View American Grilled Caesar Salad Charred romaine hearts with house-made Cae..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 15 min Easy Quick View Mexican Guacamole Fresh avocado mashed with lime, cilantro, diced tomato..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 15 min Easy Quick View Mediterranean Hummus Platter Silky smooth chickpea hummus with olive oil..." — `/`
- generic "🍽 🥄 8 ingredients ⏱ 20 min Easy Quick View American Smash Burger Thin crispy-edged beef patties with melted America..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 25 min Easy Quick View Mexican Smoky Chipotle Black Bean Tacos Spiced black beans with smoky ch..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 15 min Easy Quick View Thai Som Tum (Papaya Salad) Shredded green papaya pounded with chili, li..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 20 min Easy Quick View Mediterranean Tabbouleh Refreshing bulgur wheat salad with chopped parsl..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 35 min Easy Quick View American Cauliflower Steak Thick-cut cauliflower roasted with chimichurr..." — `/`
- generic "🍽 🥄 10 ingredients ⏱ 35 min Easy Quick View Indian Chana Masala Chickpeas simmered in spiced tomato gravy with ging..." — `/`
- generic "🍽 🥄 12 ingredients ⏱ 45 min Medium Quick View Mediterranean Falafel Wrap Crispy chickpea falafel in warm pita with ..." — `/`
- generic "🍽 🥄 5 ingredients ⏱ 45 min Easy Quick View Thai Mango Sticky Rice Sweet glutinous rice steamed with coconut milk, s..." — `/`
- generic "🍽 🥄 12 ingredients ⏱ 75 min Medium Quick View French Mushroom Bourguignon Hearty mushrooms braised in red wine with..." — `/`
- generic "🍽 🥄 12 ingredients ⏱ 75 min Hard Quick View Indian Samosa Crispy pastry triangles filled with spiced potatoes and p..." — `/`
- generic "🍽 🥄 10 ingredients ⏱ 180 min Medium Quick View American BBQ Pulled Pork Sliders Slow-smoked pulled pork with tangy ..." — `/`
- generic "🍽 🥄 15 ingredients ⏱ 90 min Hard Quick View Indian Biryani Fragrant basmati rice layered with spiced chicken, caram..." — `/`
- generic "🍽 🥄 8 ingredients ⏱ 40 min Easy Quick View Mediterranean Lemon Herb Grilled Chicken Juicy chicken marinated in lemo..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 40 min Medium Quick View Mexican Churros with Chocolate Crispy fried dough sticks coated in cin..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 30 min Easy Quick View Thai Chicken Satay Skewers Tender grilled chicken skewers with creamy pe..." — `/`
- generic "🍽 🥄 5 ingredients ⏱ 180 min Hard Quick View French Croissants Buttery, flaky laminated pastry with 27 delicate laye..." — `/`
- generic "🍽 🥄 11 ingredients ⏱ 55 min Hard Quick View Italian Truffle Mushroom Risotto Creamy Arborio rice with wild mushroom..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 45 min Medium Quick View Italian Tiramisu Coffee-soaked ladyfingers layered with mascarpone cre..." — `/`

## Session Impressions

**/:** "Quick View button does nothing; Beef Bulgogi and Korean Fried Chicken listed as Japanese. Search, cuisine, time, dietary/difficulty filters and alphabetical sort worked."
**/:** "engine sweep"

## Top Fix

Wire the Quick View button to open the recipe preview.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4104/` — Wire the Quick View button to open the recipe preview.. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4104/` again to verify.