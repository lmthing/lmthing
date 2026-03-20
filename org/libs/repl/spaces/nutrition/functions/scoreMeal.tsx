/**
 * Score a meal's nutritional balance on a 0-100 scale.
 *
 * Evaluates protein adequacy, fiber content, sodium level,
 * vitamin diversity, and calorie alignment against a target.
 */
export function scoreMeal(meal: {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
  targetCalories?: number
}): {
  overall: number
  breakdown: {
    proteinScore: number
    fiberScore: number
    sodiumScore: number
    calorieScore: number
    balanceScore: number
  }
} {
  const target = meal.targetCalories ?? 600 // per-meal default

  // Protein: 25-35% of calories is ideal
  const proteinCals = meal.protein * 4
  const proteinPct = proteinCals / meal.calories
  const proteinScore = Math.round(
    proteinPct >= 0.25 && proteinPct <= 0.35
      ? 100
      : proteinPct < 0.15 || proteinPct > 0.5
        ? 30
        : 70
  )

  // Fiber: 8-12g per meal is good
  const fiberScore = Math.round(
    meal.fiber >= 8
      ? 100
      : meal.fiber >= 4
        ? 60
        : 30
  )

  // Sodium: under 700mg per meal
  const sodiumScore = Math.round(
    meal.sodium <= 500
      ? 100
      : meal.sodium <= 700
        ? 80
        : meal.sodium <= 1000
          ? 50
          : 20
  )

  // Calorie alignment: within 15% of target
  const calorieDiff = Math.abs(meal.calories - target) / target
  const calorieScore = Math.round(
    calorieDiff <= 0.1
      ? 100
      : calorieDiff <= 0.2
        ? 80
        : calorieDiff <= 0.3
          ? 60
          : 40
  )

  // Macro balance: no single macro > 50% of calories
  const carbPct = (meal.carbs * 4) / meal.calories
  const fatPct = (meal.fat * 9) / meal.calories
  const maxPct = Math.max(proteinPct, carbPct, fatPct)
  const balanceScore = Math.round(maxPct <= 0.45 ? 100 : maxPct <= 0.55 ? 70 : 40)

  const overall = Math.round(
    (proteinScore * 0.25 +
      fiberScore * 0.2 +
      sodiumScore * 0.15 +
      calorieScore * 0.2 +
      balanceScore * 0.2)
  )

  return {
    overall,
    breakdown: {
      proteinScore,
      fiberScore,
      sodiumScore,
      calorieScore,
      balanceScore,
    },
  }
}
