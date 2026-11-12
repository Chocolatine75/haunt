---
haunt: true
target: http://localhost:4104/
date: 2026-10-19
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
top_fix: "Implement or fix the Quick View handler."
---

# Haunt Report — http://localhost:4104/
2026-10-19 · 2 areas · 1 issues

## Issues

### 1. [MAJOR] Quick View button on recipe cards does nothing when clicked: no dialog, no navigation, no text change.
- **Page:** `http://localhost:4104/`
- **Fix:** Implement or fix the Quick View handler.
- **Likely file:** `app/page.tsx` *(AI estimate — verify before editing)*
- **Evidence:** `.haunt-reports/evidence/b698b48e-ad55-4df1-9820-007fd7d80afa/issue-1` — reproduced 3 of 3 replays (100%)

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] The generic "🍽 🥄 11 ingredients ⏱ 40 min Medium Quick View Thai Green Curry with Tofu Fragrant green curry paste simmered in coc..." is covered by the generic "🥄 13 ingredients": a click on it lands on what covers it — `http://localhost:4104/` (step 4)
- [MAJOR] The button "⏱️ Time" is covered by the generic "Easy": a click on it lands on what covers it — `http://localhost:4104/` (step 27)
- [MINOR] The page is 857 px wider than the window (375 px): it scrolls sideways — `http://localhost:4104/` (step 27)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

Checks that failed, and that no issue was filed for:
- "thai" on `/` — expected: Thai filter shows only Thai recipes (3) — the page showed: ["Som Tum (Papaya Salad)","Pad Thai with Shrimp","Mango Sticky Rice","Green Curry with Tofu","Tom Yum Goong","Massaman Curry","Chicken Pho","Chicken Satay Skewers"]
- "vegan" on `/` — expected: Vegan filter shows only recipes tagged Vegan

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 15 of 82 controls exercised
- 6 test cases: 3 passed, 3 failed, 0 not run

Never exercised:
- generic "Italian" — `/`
- generic "Mexican" — `/`
- generic "Japanese" — `/`
- generic "French" — `/`
- generic "American" — `/`
- generic "Mediterranean" — `/`
- generic "Vegetarian" — `/`
- generic "Gluten-Free" — `/`
- generic "Dairy-Free" — `/`
- generic "Keto" — `/`
- generic "Paleo" — `/`
- generic "Easy" — `/`
- generic "Medium" — `/`
- generic "Under 30 min" — `/`
- generic "2+ hours" — `/`
- generic "🍽 🥄 9 ingredients ⏱ 15 min Easy Quick View Thai Som Tum (Papaya Salad) Shredded green papaya pounded with chili, li..." — `/`
- generic "🍽 🥄 5 ingredients ⏱ 25 min Easy Quick View Japanese Miso Glazed Salmon Salmon fillet marinated in sweet white miso,..." — `/`
- generic "🍽 🥄 11 ingredients ⏱ 30 min Medium Quick View Japanese Okonomiyaki Japanese savory pancake with cabbage, seafood, t..." — `/`
- generic "🍽 🥄 8 ingredients ⏱ 40 min Easy Quick View Mediterranean Lemon Herb Grilled Chicken Juicy chicken marinated in lemo..." — `/`
- generic "🍽 🥄 12 ingredients ⏱ 35 min Medium Quick View Thai Pad Thai with Shrimp Rice noodles stir-fried with jumbo shrimp, ..." — `/`
- generic "🍽 🥄 5 ingredients ⏱ 15 min Easy Quick View Italian Caprese Salad Stack Layered fresh mozzarella, heirloom tomatoes,..." — `/`
- generic "🍽 🥄 15 ingredients ⏱ 160 min Hard Quick View Japanese Tonkotsu Ramen Rich pork bone broth simmered for hours, serve..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 25 min Easy Quick View Mexican Smoky Chipotle Black Bean Tacos Spiced black beans with smoky ch..." — `/`
- generic "🍽 🥄 14 ingredients ⏱ 150 min Hard Quick View Mediterranean Lamb Tagine Slow-cooked lamb with dried apricots, almond..." — `/`
- generic "🍽 🥄 8 ingredients ⏱ 35 min Easy Quick View American Mac and Cheese Ultra-creamy three-cheese pasta baked with a cri..." — `/`
- generic "🍽 🥄 5 ingredients ⏱ 45 min Easy Quick View Thai Mango Sticky Rice Sweet glutinous rice steamed with coconut milk, s..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 65 min Medium Quick View Italian Eggplant Parmesan Breaded eggplant slices layered with marinar..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 75 min Medium Quick View French Ratatouille Thinly sliced vegetables arranged in a spiral, slow..." — `/`
- generic "🍽 🥄 11 ingredients ⏱ 40 min Medium Quick View Thai Green Curry with Tofu Fragrant green curry paste simmered in coc..." — `/`
- button "Back to top" — `/`
- generic "×" — `/`
- generic "🍽 🥄 11 ingredients ⏱ 30 min Medium Quick View Thai Tom Yum Goong Spicy and sour shrimp soup with lemongrass, galang..." — `/`
- generic "🍽 🥄 13 ingredients ⏱ 80 min Medium Quick View Thai Massaman Curry Rich and mild curry with tender beef, potatoes, p..." — `/`
- generic "🍽 🥄 12 ingredients ⏱ 70 min Medium Quick View Thai Chicken Pho Clear aromatic broth with rice noodles, poached chic..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 30 min Easy Quick View Thai Chicken Satay Skewers Tender grilled chicken skewers with creamy pe..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 15 min Easy Quick View Mexican Guacamole Fresh avocado mashed with lime, cilantro, diced tomato..." — `/`
- generic "🍽 🥄 6 ingredients ⏱ 15 min Easy Quick View American Acai Bowl Thick blended acai topped with granola, fresh berries..." — `/`
- generic "🍽 🥄 4 ingredients ⏱ 15 min Medium Quick View Japanese Tamagoyaki Sweet Japanese rolled omelette with dashi, careful..." — `/`
- generic "🍽 🥄 10 ingredients ⏱ 20 min Easy Quick View Japanese Spicy Tuna Poke Bowl Fresh ahi tuna cubes in spicy mayo and so..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 20 min Easy Quick View American Grilled Caesar Salad Charred romaine hearts with house-made Cae..." — `/`
- generic "🍽 🥄 6 ingredients ⏱ 20 min Easy Quick View Mexican Elote (Mexican Street Corn) Grilled corn on the cob slathered wi..." — `/`
- generic "🍽 🥄 8 ingredients ⏱ 20 min Easy Quick View American Smash Burger Thin crispy-edged beef patties with melted America..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 20 min Easy Quick View Mediterranean Tabbouleh Refreshing bulgur wheat salad with chopped parsl..." — `/`
- generic "🍽 🥄 5 ingredients ⏱ 25 min Medium Quick View Italian Carbonara Spaghetti with crispy guanciale, egg yolk, Pecorino ..." — `/`
- generic "🍽 🥄 10 ingredients ⏱ 25 min Easy Quick View American Cobb Salad Rows of grilled chicken, bacon, avocado, egg, blue ..." — `/`
- generic "🍽 🥄 10 ingredients ⏱ 35 min Easy Quick View Indian Chana Masala Chickpeas simmered in spiced tomato gravy with ging..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 40 min Easy Quick View Indian Chicken Tikka Kebabs Yogurt-marinated chicken pieces grilled to p..." — `/`
- generic "🍽 🥄 10 ingredients ⏱ 40 min Medium Quick View Indian Palak Paneer Cubes of paneer cheese in a smooth spinach gravy ..." — `/`
- generic "🍽 🥄 14 ingredients ⏱ 60 min Medium Quick View Indian Butter Chicken Masala Tender chicken pieces in a rich tomato-c..." — `/`
- generic "🍽 🥄 12 ingredients ⏱ 75 min Hard Quick View Indian Samosa Crispy pastry triangles filled with spiced potatoes and p..." — `/`
- generic "🍽 🥄 10 ingredients ⏱ 90 min Medium Quick View Indian Dal Makhani Creamy black lentils slow-cooked with butter, crea..." — `/`
- generic "🍽 🥄 15 ingredients ⏱ 90 min Hard Quick View Indian Biryani Fragrant basmati rice layered with spiced chicken, caram..." — `/`
- generic "🍽 🥄 8 ingredients ⏱ 35 min Medium Quick View Japanese Vegetable Tempura Lightly battered seasonal vegetables deep-f..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 35 min Easy Quick View American Cauliflower Steak Thick-cut cauliflower roasted with chimichurr..." — `/`
- generic "🍽 🥄 12 ingredients ⏱ 45 min Medium Quick View Mediterranean Falafel Wrap Crispy chickpea falafel in warm pita with ..." — `/`
- generic "🍽 🥄 12 ingredients ⏱ 75 min Medium Quick View French Mushroom Bourguignon Hearty mushrooms braised in red wine with..." — `/`
- generic "🍽 🥄 11 ingredients ⏱ 55 min Hard Quick View Italian Truffle Mushroom Risotto Creamy Arborio rice with wild mushroom..." — `/`
- generic "🍽 🥄 5 ingredients ⏱ 80 min Hard Quick View French Creme Brulee Silky vanilla custard with a perfectly caramelized s..." — `/`
- generic "🍽 🥄 14 ingredients ⏱ 90 min Hard Quick View French Bouillabaisse Provencal seafood stew with saffron broth, fresh f..." — `/`
- generic "🍽 🥄 14 ingredients ⏱ 100 min Hard Quick View Mediterranean Greek Moussaka Layered eggplant, spiced lamb, and creamy..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 120 min Hard Quick View Japanese Matcha Green Tea Cheesecake Creamy Japanese-style cheesecake i..." — `/`
- generic "🍽 🥄 13 ingredients ⏱ 120 min Hard Quick View French Coq au Vin Chicken braised in Burgundy wine with lardons, mushr..." — `/`
- generic "🍽 🥄 5 ingredients ⏱ 180 min Hard Quick View French Croissants Buttery, flaky laminated pastry with 27 delicate laye..." — `/`
- generic "🍽 🥄 8 ingredients ⏱ 60 min Medium Quick View French Quiche Lorraine Buttery pastry filled with silky egg custard, c..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 45 min Medium Quick View Japanese Sushi Hand Rolls Crispy nori wrapped around seasoned sushi ri..." — `/`
- generic "🍽 🥄 12 ingredients ⏱ 60 min Medium Quick View American Nashville Hot Chicken Buttermilk-brined fried chicken coated..." — `/`
- generic "🍽 🥄 8 ingredients ⏱ 40 min Easy Quick View American Loaded Sweet Potato Fries Crispy sweet potato fries topped with..." — `/`

## Session Impressions

**/:** "Quick View button on recipe cards does nothing; search, sort and filters worked."
**/:** "engine sweep"

## Top Fix

Implement or fix the Quick View handler.

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

1. [MAJOR] `http://localhost:4104/` — Implement or fix the Quick View handler.. Likely in `app/page.tsx`.

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4104/` again to verify.