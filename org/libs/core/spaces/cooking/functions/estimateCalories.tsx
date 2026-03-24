/** Calculate estimated calories from macronutrient grams */

export function estimateCalories(proteinG: number, carbsG: number, fatG: number): {
  protein: number;
  carbs: number;
  fat: number;
  total: number;
} {
  const protein = Math.round(proteinG * 4);
  const carbs = Math.round(carbsG * 4);
  const fat = Math.round(fatG * 9);
  return { protein, carbs, fat, total: protein + carbs + fat };
}
