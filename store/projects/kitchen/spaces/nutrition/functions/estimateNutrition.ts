export interface NutritionEstimate {
  caloriesPerUnit: number;
  proteinPerUnit: number;
  carbsPerUnit: number;
  fatPerUnit: number;
  basisNote: string;
}

/** Typical macro profile per 100g/100ml of a food category, before per-unit conversion. */
interface CategoryProfile {
  key: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Rough weight in grams of "one" of this thing, used only when `unit === 'count'`. */
  countGrams: number;
  label: string;
}

const PROFILES: CategoryProfile[] = [
  // Oils, butter, and other near-pure fats — very calorie-dense, negligible protein/carbs.
  { key: 'oil-fat', calories: 884, protein: 0, carbs: 0, fat: 100, countGrams: 5, label: 'oil/fat' },
  // Meat, poultry, fish, eggs, tofu/tempeh — protein-forward with moderate fat, ~no carbs.
  { key: 'protein', calories: 200, protein: 25, carbs: 0, fat: 10, countGrams: 150, label: 'meat/fish/protein' },
  // Grains, pasta, rice, bread, flour, potatoes — carb-forward, dry-weight dense.
  { key: 'grain', calories: 350, protein: 8, carbs: 75, fat: 2, countGrams: 50, label: 'grain/starch' },
  // Fresh produce/vegetables — low calorie density, mostly water.
  { key: 'vegetable', calories: 35, protein: 2, carbs: 7, fat: 0.3, countGrams: 120, label: 'vegetable/produce' },
  // Fruit — a bit more sugar/calories than vegetables, still low-fat.
  { key: 'fruit', calories: 55, protein: 0.7, carbs: 14, fat: 0.2, countGrams: 150, label: 'fruit' },
  // Milk, cheese, yogurt — mixed protein/fat, moderate carbs (lactose).
  { key: 'dairy', calories: 100, protein: 6, carbs: 5, fat: 5, countGrams: 30, label: 'dairy' },
  // Sugar, honey, baked sweets, candy — almost pure carbs, calorie-dense.
  { key: 'sweet', calories: 380, protein: 1, carbs: 90, fat: 2, countGrams: 30, label: 'sugar/sweet' },
  // Fallback for anything that doesn't match a keyword — a mild, generic profile.
  { key: 'other', calories: 120, protein: 5, carbs: 15, fat: 4, countGrams: 100, label: 'unclassified' },
];

// Keyword → profile key. Checked in order, first match wins, so more specific/distinctive
// keywords are listed before broad catch-alls within the same profile.
const KEYWORD_RULES: Array<{ pattern: RegExp; profileKey: string }> = [
  { pattern: /\b(oil|butter|lard|ghee|margarine|mayonnaise)\b/, profileKey: 'oil-fat' },
  { pattern: /\b(chicken|beef|pork|lamb|turkey|bacon|sausage|fish|salmon|tuna|shrimp|prawn|egg|tofu|tempeh|seitan|meat)\b/, profileKey: 'protein' },
  { pattern: /\b(rice|pasta|noodle|bread|flour|oat|grain|quinoa|potato|couscous|tortilla|cereal)\b/, profileKey: 'grain' },
  { pattern: /\b(milk|cheese|yogurt|yoghurt|cream|dairy)\b/, profileKey: 'dairy' },
  { pattern: /\b(sugar|honey|syrup|chocolate|candy|jam|cookie|cake|dessert)\b/, profileKey: 'sweet' },
  { pattern: /\b(apple|banana|berry|berries|orange|grape|melon|mango|fruit|lemon|lime)\b/, profileKey: 'fruit' },
  { pattern: /\b(onion|garlic|tomato|pepper|carrot|broccoli|spinach|lettuce|cabbage|vegetable|produce|herb|greens)\b/, profileKey: 'vegetable' },
];

const CATEGORY_RULES: Array<{ pattern: RegExp; profileKey: string }> = [
  { pattern: /oil|fat/, profileKey: 'oil-fat' },
  { pattern: /meat|fish|protein|seafood/, profileKey: 'protein' },
  { pattern: /grain|pasta|bakery|bread|starch/, profileKey: 'grain' },
  { pattern: /dairy/, profileKey: 'dairy' },
  { pattern: /sweet|sugar|dessert/, profileKey: 'sweet' },
  { pattern: /fruit/, profileKey: 'fruit' },
  { pattern: /produce|vegetable/, profileKey: 'vegetable' },
];

/**
 * Estimates a coarse per-unit nutrition profile for an ingredient from its name/category/unit
 * alone — a starting point the nutritionist inserts into `nutrition_facts` when nothing better is
 * known yet, not a substitute for a real nutrition database. Matching is keyword-based: the
 * ingredient's `name` is checked first against a small set of food-category keyword patterns
 * (oil/fat, meat/fish/protein, grain/starch, dairy, sweet, fruit, vegetable), falling back to
 * `category` if the name doesn't match anything, and finally to a mild generic profile.
 *
 * The category's typical "per 100g/100ml" macro profile is then scaled to the ingredient's actual
 * `unit`: for `'g'`/`'ml'` this is a straight divide-by-100; for `'count'` (a whole item — "1
 * onion", "2 eggs") it uses a rough typical-piece weight for that category instead. Any other unit
 * string is treated like `'g'` as a reasonable default. Always deterministic — same inputs, same
 * output — so it can be freely recomputed without drifting.
 */
export function estimateNutrition(
  name: string,
  category: string | undefined,
  unit: string,
): NutritionEstimate {
  const nameLower = (name ?? '').toLowerCase();
  const categoryLower = (category ?? '').toLowerCase();

  let profileKey = 'other';
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(nameLower)) {
      profileKey = rule.profileKey;
      break;
    }
  }
  if (profileKey === 'other' && categoryLower) {
    for (const rule of CATEGORY_RULES) {
      if (rule.pattern.test(categoryLower)) {
        profileKey = rule.profileKey;
        break;
      }
    }
  }

  const profile = PROFILES.find((p) => p.key === profileKey) ?? PROFILES[PROFILES.length - 1];

  // Scale the per-100g/ml profile down to the ingredient's actual unit.
  const perHundredToUnit = unit === 'count' ? profile.countGrams / 100 : 1 / 100;

  const basisNote =
    unit === 'count'
      ? `estimated as ${profile.label}, ~${profile.countGrams}g per count`
      : `estimated as ${profile.label}, per 1${unit || 'g'} (typical per-100${unit === 'ml' ? 'ml' : 'g'} profile)`;

  return {
    caloriesPerUnit: round2(profile.calories * perHundredToUnit),
    proteinPerUnit: round2(profile.protein * perHundredToUnit),
    carbsPerUnit: round2(profile.carbs * perHundredToUnit),
    fatPerUnit: round2(profile.fat * perHundredToUnit),
    basisNote,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
