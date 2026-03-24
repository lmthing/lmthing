/**
 * Build a grocery list from multiple recipe ingredient arrays.
 * Deduplicates items by lowercased name.
 */

export function buildGroceryList(recipes: Array<{ name: string; ingredients: string[]; }>): Array<{
  item: string;
  recipes: string[];
}> {
  const map = new Map<string, Set<string>>();
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const key = ingredient.replace(/^[\d./\s]+/, '').toLowerCase().trim();
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(recipe.name);
    }
  }
  return [...map.entries()].map(([item, sources]) => ({
    item,
    recipes: [...sources],
  }));
}
