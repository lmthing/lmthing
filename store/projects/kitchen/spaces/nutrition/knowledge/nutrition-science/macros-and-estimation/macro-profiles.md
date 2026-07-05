# Macro profiles by food family

`estimateNutrition` doesn't try to identify a specific ingredient's exact nutrition — it classifies
the ingredient into one of eight broad food-family profiles and uses that family's typical
per-100g/100ml macro composition. The classification is keyword-based: the ingredient's `name` is
checked first against a list of keyword patterns (oil/butter/lard → oils-and-fats; chicken/beef/
fish/egg/tofu → proteins; rice/pasta/bread/potato → grains; and so on), checked in a fixed order so
a more specific, distinctive keyword is matched before a broad catch-all. If nothing in the name
matches, the ingredient's `category` column (a grocery-aisle grouping like "produce" or "dairy") is
tried as a fallback. If neither matches anything, the ingredient gets a mild, generic "unclassified"
profile rather than a wild guess in either direction.

## The eight profiles

- **Oils and fats** (oil, butter, lard, ghee, margarine, mayonnaise) — ~884 kcal, 0g protein, 0g
  carbs, 100g fat per 100g. This is close to the real figure for a pure fat (9 kcal per gram of fat,
  so ~98g of fat per 100g already gets you to ~882 kcal) — oils and rendered fats are about as
  calorie-dense as food gets, and carry essentially no protein or carbohydrate.
- **Proteins** (chicken, beef, pork, lamb, turkey, bacon, sausage, fish, salmon, tuna, shrimp, egg,
  tofu, tempeh, seitan) — ~200 kcal, 25g protein, 0g carbs, 10g fat per 100g. This is a deliberately
  *blended* average across a wide range: a skinless chicken breast is closer to 120–165 kcal/100g
  with very little fat, while bacon or a fatty sausage can run 400–540 kcal/100g. 200 kcal sits in
  the middle of that range rather than matching any one protein exactly — the estimate will run low
  for very lean proteins and high for very fatty ones.
- **Grains and starches** (rice, pasta, bread, flour, oats, quinoa, potato, couscous, tortilla,
  cereal) — ~350 kcal, 8g protein, 75g carbs, 2g fat per 100g **dry weight**. This matches dry pasta
  or rice reasonably well, but a cooked, water-absorbed portion of the same food is much less
  calorie-dense per 100g — the profile is closest to how these ingredients are typically stocked
  and measured in a pantry, not how they land on a plate.
- **Dairy** (milk, cheese, yogurt, cream) — ~100 kcal, 6g protein, 5g carbs, 5g fat per 100g. A
  genuinely mixed category in reality: milk and yogurt sit well below this, hard cheese well above
  it. The blended figure is a reasonable middle ground for a pantry-wide "dairy" bucket.
- **Produce/vegetables** (onion, garlic, tomato, pepper, carrot, broccoli, spinach, lettuce, greens)
  — ~35 kcal, 2g protein, 7g carbs, 0.3g fat per 100g. Vegetables are overwhelmingly water by
  weight, so this low-density profile is accurate for the category as a whole, even though a starchy
  vegetable like a potato is separately classified under grains.
- **Fruit** (apple, banana, berries, orange, grape, melon, mango, lemon, lime) — ~55 kcal, 0.7g
  protein, 14g carbs, 0.2g fat per 100g. A step up from vegetables mainly in natural sugar content,
  still essentially fat-free.
- **Sweets** (sugar, honey, syrup, chocolate, candy, jam, cookie, cake) — ~380 kcal, 1g protein, 90g
  carbs, 2g fat per 100g. Close to pure sugar's ~400 kcal/100g; chocolate and baked sweets add a bit
  of fat and protein but stay carb-dominated.
- **Unclassified (fallback)** — ~120 kcal, 5g protein, 15g carbs, 4g fat per 100g. A deliberately
  mild, middle-of-the-road profile used only when nothing else matched — the goal is to avoid a
  wildly wrong number for an unrecognized ingredient, not to be accurate for any specific one.

## Where this is weakest

The single biggest source of error is **within-family variance**: "protein" alone spans lean fish to
fatty bacon by a factor of three or more in calorie density, and "dairy" spans skim milk to aged
cheddar just as widely. A recipe built entirely from ingredients at one extreme of their family's
range will have its true nutrition meaningfully under- or over-estimated even though each individual
classification was "correct." Keyword ordering also matters: because the first matching rule wins,
an ingredient whose name contains two plausible keywords (e.g., an ingredient literally named
"chicken stock cube" might match "chicken" before anything else) is classified by whichever keyword
appears first in the rule list, not by which one best describes the actual food. None of this makes
the estimate useless — it is calibrated to be directionally right and internally consistent (the
same ingredient always estimates the same way) — but it is exactly why `basisNote` exists, and why
no agent should quote one of these numbers as if it came from a lab.
