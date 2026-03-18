// ── Utility Functions ──
/** Scale a recipe's ingredient quantities by a multiplier */

export function scaleIngredients(ingredients: string[], multiplier: number): string[] {
  return ingredients.map(item => {
    return item.replace(/^([\d./]+)/, (_, n) => {
      const val = n.includes('/') ? n.split('/').reduce((a: number, b: string) => a / Number(b), Number(n.split('/')[0]) * Number(n.split('/')[0])) : Number(n);
      return String(Math.round(val * multiplier * 100) / 100);
    });
  });
}
