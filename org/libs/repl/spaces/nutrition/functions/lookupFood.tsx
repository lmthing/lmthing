/**
 * Look up nutritional data for a food item.
 *
 * Returns per-100g nutritional values. Use with portion size
 * to calculate actual meal nutrition.
 */
export function lookupFood(name: string): {
  name: string
  per100g: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    sodium: number
  }
  category: string
} | null {
  const db: Record<string, { cal: number; p: number; c: number; f: number; fb: number; na: number; cat: string }> = {
    "chicken breast": { cal: 165, p: 31, c: 0, f: 3.6, fb: 0, na: 74, cat: "protein" },
    "salmon": { cal: 208, p: 20, c: 0, f: 13, fb: 0, na: 59, cat: "protein" },
    "ground beef": { cal: 250, p: 26, c: 0, f: 15, fb: 0, na: 66, cat: "protein" },
    "egg": { cal: 155, p: 13, c: 1.1, f: 11, fb: 0, na: 124, cat: "protein" },
    "tofu": { cal: 76, p: 8, c: 1.9, f: 4.8, fb: 0.3, na: 7, cat: "protein" },
    "shrimp": { cal: 99, p: 24, c: 0.2, f: 0.3, fb: 0, na: 111, cat: "protein" },
    "white rice": { cal: 130, p: 2.7, c: 28, f: 0.3, fb: 0.4, na: 1, cat: "grain" },
    "pasta": { cal: 158, p: 5.8, c: 31, f: 0.9, fb: 1.8, na: 1, cat: "grain" },
    "quinoa": { cal: 120, p: 4.4, c: 21, f: 1.9, fb: 2.8, na: 7, cat: "grain" },
    "potato": { cal: 93, p: 2.5, c: 21, f: 0.1, fb: 2.2, na: 7, cat: "vegetable" },
    "broccoli": { cal: 34, p: 2.8, c: 7, f: 0.4, fb: 2.6, na: 33, cat: "vegetable" },
    "spinach": { cal: 23, p: 2.9, c: 3.6, f: 0.4, fb: 2.2, na: 79, cat: "vegetable" },
    "tomato": { cal: 18, p: 0.9, c: 3.9, f: 0.2, fb: 1.2, na: 5, cat: "vegetable" },
    "olive oil": { cal: 884, p: 0, c: 0, f: 100, fb: 0, na: 2, cat: "fat" },
    "butter": { cal: 717, p: 0.9, c: 0.1, f: 81, fb: 0, na: 11, cat: "fat" },
    "avocado": { cal: 160, p: 2, c: 9, f: 15, fb: 7, na: 7, cat: "fat" },
    "parmesan": { cal: 431, p: 38, c: 4.1, f: 29, fb: 0, na: 1529, cat: "dairy" },
    "mozzarella": { cal: 280, p: 28, c: 3.1, f: 17, fb: 0, na: 627, cat: "dairy" },
    "greek yogurt": { cal: 59, p: 10, c: 3.6, f: 0.4, fb: 0, na: 36, cat: "dairy" },
  }

  const key = name.toLowerCase().trim()
  const entry = db[key]
  if (!entry) return null

  return {
    name: key,
    per100g: {
      calories: entry.cal,
      protein: entry.p,
      carbs: entry.c,
      fat: entry.f,
      fiber: entry.fb,
      sodium: entry.na,
    },
    category: entry.cat,
  }
}
