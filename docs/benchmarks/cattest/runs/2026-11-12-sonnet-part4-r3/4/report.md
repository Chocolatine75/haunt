---
haunt: true
target: http://localhost:4104/
date: 2026-11-12
areas_tested: 2
issues:
  total: 0
  critical: 0
  major: 0
  minor: 0
signals:
  total: 3
  major: 2
  minor: 1
top_fix: ""
---

# Haunt Report — http://localhost:4104/
2026-11-12 · 2 areas · 0 issues

## Issues

_No issues found._

## Detected automatically

Found by the engine itself, not by a tester: server errors, exceptions, failed and slow requests, dead controls, accessibility violations.

- [MAJOR] The generic "🍽 🥄 11 ingredients ⏱ 50 min Medium Quick View Japanese Korean Fried Chicken Double-fried chicken wings coated in sw..." is covered by the generic "🍽 🥄 10 ingredients ⏱ 25 min Easy Quick View American Cobb Salad Rows of grilled chicken, bacon, avocado, egg, blue ...": a click on it lands on what covers it — `http://localhost:4104/` (step 6)
- [MAJOR] The button "Quick View" is covered by the generic "🍽 🥄 10 ingredients ⏱ 25 min Easy Quick View American Cobb Salad Rows of grilled chicken, bacon, avocado, egg, blue ...": a click on it lands on what covers it — `http://localhost:4104/` (step 6)
- [MINOR] The page is 887 px wider than the window (375 px): it scrolls sideways — `http://localhost:4104/` (step 24)

## To check by hand

Seen by a tester, and nothing the engine could verify by itself. Not counted. Each comes with the steps that led to it.

- [MAJOR] Quick View button on a recipe card does nothing when clicked (no dialog, no navigation, no change). (`http://localhost:4104/`)
  - Expected: Clicking Quick View opens a recipe preview
  - Seen: No change at all after click
  - Steps: `.haunt-reports/evidence/f2979df6-e417-44a7-be29-930ff82b5d91/issue-1`
- [MINOR] Korean dishes (Korean Fried Chicken, Beef Bulgogi) are categorised as Japanese cuisine. (`http://localhost:4104/`)
  - Expected: Korean dishes not listed under Japanese
  - Seen: Japanese filter returns Korean Fried Chicken and Beef Bulgogi
  - Steps: `.haunt-reports/evidence/f2979df6-e417-44a7-be29-930ff82b5d91/issue-3`

Checks that failed, and that no issue was filed for:
- "cuisine-jp" on `/` — expected: Japanese filter shows only Japanese recipes

## Coverage

Counted by the engine from the actions that ran, not from what a tester says it did.

- 14 of 88 controls exercised
- 3 test cases: 2 passed, 1 failed, 0 not run

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
- generic "Easy" — `/`
- generic "Medium" — `/`
- generic "30-60 min" — `/`
- generic "1-2 hours" — `/`
- generic "2+ hours" — `/`
- generic "🍽 🥄 8 ingredients ⏱ 35 min Medium Quick View Japanese Vegetable Tempura Lightly battered seasonal vegetables deep-f..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 25 min Easy Quick View Mexican Smoky Chipotle Black Bean Tacos Spiced black beans with smoky ch..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 40 min Medium Quick View Mexican Churros with Chocolate Crispy fried dough sticks coated in cin..." — `/`
- generic "🍽 🥄 10 ingredients ⏱ 180 min Medium Quick View American BBQ Pulled Pork Sliders Slow-smoked pulled pork with tangy ..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 120 min Hard Quick View Japanese Matcha Green Tea Cheesecake Creamy Japanese-style cheesecake i..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 35 min Easy Quick View American Cauliflower Steak Thick-cut cauliflower roasted with chimichurr..." — `/`
- generic "🍽 🥄 11 ingredients ⏱ 30 min Easy Quick View Mediterranean Mediterranean Quinoa Bowl Fluffy quinoa with roasted chic..." — `/`
- generic "🍽 🥄 11 ingredients ⏱ 50 min Medium Quick View Japanese Korean Fried Chicken Double-fried chicken wings coated in sw..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 20 min Easy Quick View American Grilled Caesar Salad Charred romaine hearts with house-made Cae..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 40 min Easy Quick View Indian Chicken Tikka Kebabs Yogurt-marinated chicken pieces grilled to p..." — `/`
- generic "🍽 🥄 8 ingredients ⏱ 60 min Medium Quick View French Quiche Lorraine Buttery pastry filled with silky egg custard, c..." — `/`
- generic "🍽 🥄 12 ingredients ⏱ 75 min Medium Quick View French Mushroom Bourguignon Hearty mushrooms braised in red wine with..." — `/`
- generic "🍽 🥄 11 ingredients ⏱ 55 min Medium Quick View Mexican Chicken Enchiladas Verdes Corn tortillas filled with shredded..." — `/`
- generic "🍽 🥄 5 ingredients ⏱ 25 min Easy Quick View Japanese Miso Glazed Salmon Salmon fillet marinated in sweet white miso,..." — `/`
- generic "🍽 🥄 5 ingredients ⏱ 180 min Hard Quick View French Croissants Buttery, flaky laminated pastry with 27 delicate laye..." — `/`
- generic "Italian Mexican Japanese Indian French Thai American Mediterranean" — `/`
- generic "🍽 🥄 11 ingredients ⏱ 30 min Medium Quick View Japanese Okonomiyaki Japanese savory pancake with cabbage, seafood, t..." — `/`
- generic "🍽 🥄 10 ingredients ⏱ 20 min Easy Quick View Japanese Spicy Tuna Poke Bowl Fresh ahi tuna cubes in spicy mayo and so..." — `/`
- generic "🍽 🥄 15 ingredients ⏱ 160 min Hard Quick View Japanese Tonkotsu Ramen Rich pork bone broth simmered for hours, serve..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 45 min Medium Quick View Japanese Sushi Hand Rolls Crispy nori wrapped around seasoned sushi ri..." — `/`
- generic "🍽 🥄 8 ingredients ⏱ 35 min Easy Quick View Japanese Beef Bulgogi Thinly sliced beef marinated in sweet soy-sesame s..." — `/`
- generic "🍽 🥄 4 ingredients ⏱ 15 min Medium Quick View Japanese Tamagoyaki Sweet Japanese rolled omelette with dashi, careful..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 30 min Easy Quick View Thai Chicken Satay Skewers Tender grilled chicken skewers with creamy pe..." — `/`
- generic "🍽 🥄 13 ingredients ⏱ 120 min Hard Quick View French Coq au Vin Chicken braised in Burgundy wine with lardons, mushr..." — `/`
- generic "🍽 🥄 14 ingredients ⏱ 60 min Medium Quick View Indian Butter Chicken Masala Tender chicken pieces in a rich tomato-c..." — `/`
- generic "🍽 🥄 12 ingredients ⏱ 60 min Medium Quick View American Nashville Hot Chicken Buttermilk-brined fried chicken coated..." — `/`
- generic "🍽 🥄 15 ingredients ⏱ 90 min Hard Quick View Indian Biryani Fragrant basmati rice layered with spiced chicken, caram..." — `/`
- generic "🍽 🥄 8 ingredients ⏱ 40 min Easy Quick View Mediterranean Lemon Herb Grilled Chicken Juicy chicken marinated in lemo..." — `/`
- generic "🍽 🥄 12 ingredients ⏱ 70 min Medium Quick View Thai Chicken Pho Clear aromatic broth with rice noodles, poached chic..." — `/`
- generic "🍽 🥄 10 ingredients ⏱ 25 min Easy Quick View American Cobb Salad Rows of grilled chicken, bacon, avocado, egg, blue ..." — `/`
- generic "🥄 10 ingredients ⏱ 25 min Easy Quick View" — `/`
- generic "🍽 🥄 11 ingredients ⏱ 55 min Hard Quick View Italian Truffle Mushroom Risotto Creamy Arborio rice with wild mushroom..." — `/`
- generic "🍽 🥄 5 ingredients ⏱ 80 min Hard Quick View French Creme Brulee Silky vanilla custard with a perfectly caramelized s..." — `/`
- generic "🍽 🥄 8 ingredients ⏱ 90 min Medium Quick View French Classic French Onion Soup Deeply caramelized onions in rich bee..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 50 min Medium Quick View Italian Classic Margherita Pizza Hand-stretched dough with San Marzano..." — `/`
- generic "🍽 🥄 5 ingredients ⏱ 25 min Medium Quick View Italian Carbonara Spaghetti with crispy guanciale, egg yolk, Pecorino ..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 45 min Medium Quick View Italian Tiramisu Coffee-soaked ladyfingers layered with mascarpone cre..." — `/`
- generic "🍽 🥄 12 ingredients ⏱ 35 min Medium Quick View Thai Pad Thai with Shrimp Rice noodles stir-fried with jumbo shrimp, ..." — `/`
- generic "🍽 🥄 5 ingredients ⏱ 45 min Easy Quick View Thai Mango Sticky Rice Sweet glutinous rice steamed with coconut milk, s..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 15 min Easy Quick View Mexican Guacamole Fresh avocado mashed with lime, cilantro, diced tomato..." — `/`
- generic "🍽 🥄 9 ingredients ⏱ 75 min Medium Quick View French Ratatouille Thinly sliced vegetables arranged in a spiral, slow..." — `/`
- generic "🍽 🥄 10 ingredients ⏱ 35 min Easy Quick View Indian Chana Masala Chickpeas simmered in spiced tomato gravy with ging..." — `/`
- generic "🍽 🥄 12 ingredients ⏱ 75 min Hard Quick View Indian Samosa Crispy pastry triangles filled with spiced potatoes and p..." — `/`
- generic "🍽 🥄 12 ingredients ⏱ 45 min Medium Quick View Mediterranean Falafel Wrap Crispy chickpea falafel in warm pita with ..." — `/`
- generic "🍽 🥄 6 ingredients ⏱ 15 min Easy Quick View American Acai Bowl Thick blended acai topped with granola, fresh berries..." — `/`
- generic "🍽 🥄 11 ingredients ⏱ 40 min Medium Quick View Thai Green Curry with Tofu Fragrant green curry paste simmered in coc..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 15 min Easy Quick View Mediterranean Hummus Platter Silky smooth chickpea hummus with olive oil..." — `/`
- generic "🍽 🥄 7 ingredients ⏱ 20 min Easy Quick View Mediterranean Tabbouleh Refreshing bulgur wheat salad with chopped parsl..." — `/`
- generic "🍽 🥄 14 ingredients ⏱ 150 min Hard Quick View Mediterranean Lamb Tagine Slow-cooked lamb with dried apricots, almond..." — `/`
- generic "🍽 🥄 14 ingredients ⏱ 90 min Hard Quick View French Bouillabaisse Provencal seafood stew with saffron broth, fresh f..." — `/`
- generic "🍽 🥄 14 ingredients ⏱ 100 min Hard Quick View Mediterranean Greek Moussaka Layered eggplant, spiced lamb, and creamy..." — `/`
- generic "🥄 5 ingredients ⏱ 180 min Hard Quick View" — `/`
- generic "🍽 🥄 10 ingredients ⏱ 40 min Medium Quick View Indian Palak Paneer Cubes of paneer cheese in a smooth spinach gravy ..." — `/`
- generic "🍽 🥄 10 ingredients ⏱ 90 min Medium Quick View Indian Dal Makhani Creamy black lentils slow-cooked with butter, crea..." — `/`
- generic "🍽 🥄 8 ingredients ⏱ 40 min Medium Quick View Italian Pesto Gnocchi Pillowy potato gnocchi tossed in vibrant basil p..." — `/`
- generic "🍽 🥄 13 ingredients ⏱ 120 min Medium Quick View Mexican Pozole Rojo Hearty pork and hominy stew in rich red chili br..." — `/`
- generic "🍽 🥄 6 ingredients ⏱ 20 min Easy Quick View Mexican Elote (Mexican Street Corn) Grilled corn on the cob slathered wi..." — `/`

## Session Impressions

**/:** "Quick View on a recipe card appears to do nothing; Korean Fried Chicken and Beef Bulgogi are filed under Japanese cuisine. Search, sort, filters, clear controls and empty state worked."
**/:** "engine sweep"

## For Claude

The following issues were found by Haunt. Fix them in order of severity.

_No issues found._

Then fix what is listed under "Detected automatically".

After fixing, run `/haunt:haunt-test http://localhost:4104/` again to verify.