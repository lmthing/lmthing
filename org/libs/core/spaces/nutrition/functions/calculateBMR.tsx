/**
 * Calculate Basal Metabolic Rate using the Mifflin-St Jeor equation.
 *
 * Returns BMR and estimated daily calorie needs at different activity levels.
 */
export function calculateBMR(params: {
  weightKg: number
  heightCm: number
  age: number
  sex: "male" | "female"
}): {
  bmr: number
  sedentary: number
  lightlyActive: number
  moderatelyActive: number
  veryActive: number
} {
  const { weightKg, heightCm, age, sex } = params

  // Mifflin-St Jeor equation
  const bmr =
    sex === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161

  return {
    bmr: Math.round(bmr),
    sedentary: Math.round(bmr * 1.2),
    lightlyActive: Math.round(bmr * 1.375),
    moderatelyActive: Math.round(bmr * 1.55),
    veryActive: Math.round(bmr * 1.725),
  }
}
