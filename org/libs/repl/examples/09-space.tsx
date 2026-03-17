/**
 * Example 9: Multi-space knowledge base
 *
 * A cooking & nutrition assistant that loads knowledge from multiple spaces.
 * Demonstrates: loadKnowledge() global, multiple spaces via replConfig.spaces and --space flag,
 * catalog tools via replConfig.catalog, built-in form components via replConfig.components.
 *
 * Bundled spaces:
 *   examples/spaces/cooking/    — cuisine/type, technique/method, dietary/restriction
 *   examples/spaces/nutrition/  — macronutrients/type, vitamins/nutrient, meal-planning/strategy
 *
 * Run (spaces from replConfig):
 *   npx tsx src/cli/bin.ts examples/09-space.tsx -m openai:gpt-4o-mini
 *
 * Run (override/extend via CLI):
 *   npx tsx src/cli/bin.ts examples/09-space.tsx --space examples/spaces/cooking --space examples/spaces/nutrition -m openai:gpt-4o-mini
 */

import React from 'react'

// ── Utility Functions ──

/** Scale a recipe's ingredient quantities by a multiplier */
export function scaleIngredients(ingredients: string[], multiplier: number): string[] {
  return ingredients.map(item => {
    return item.replace(/^([\d./]+)/, (_, n) => {
      const val = n.includes('/') ? n.split('/').reduce((a: number, b: string) => a / Number(b), Number(n.split('/')[0]) * Number(n.split('/')[0])) : Number(n)
      return String(Math.round(val * multiplier * 100) / 100)
    })
  })
}

/** Calculate estimated calories from macronutrient grams */
export function estimateCalories(proteinG: number, carbsG: number, fatG: number): {
  protein: number
  carbs: number
  fat: number
  total: number
} {
  const protein = Math.round(proteinG * 4)
  const carbs = Math.round(carbsG * 4)
  const fat = Math.round(fatG * 9)
  return { protein, carbs, fat, total: protein + carbs + fat }
}

/**
 * Build a grocery list from multiple recipe ingredient arrays.
 * Deduplicates items by lowercased name.
 */
export function buildGroceryList(recipes: Array<{ name: string; ingredients: string[] }>): Array<{
  item: string
  recipes: string[]
}> {
  const map = new Map<string, Set<string>>()
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const key = ingredient.replace(/^[\d./\s]+/, '').toLowerCase().trim()
      if (!map.has(key)) map.set(key, new Set())
      map.get(key)!.add(recipe.name)
    }
  }
  return [...map.entries()].map(([item, sources]) => ({
    item,
    recipes: [...sources],
  }))
}

/**
 * Format a duration in minutes to a human-readable string.
 * @param minutes Total time in minutes
 */
export function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

// ── React Components ──

/** Display a recipe card */
export function RecipeCard({ name, cuisine, method, servings, time, ingredients, steps }: {
  name: string
  cuisine: string
  method: string
  servings: number
  time: string
  ingredients: string[]
  steps: string[]
}) {
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, maxWidth: 520, fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>{name}</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
        {cuisine} · {method} · {servings} servings · {time}
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Ingredients</div>
        {ingredients.map((item, i) => (
          <div key={i} style={{ fontSize: 14, padding: '2px 0' }}>• {item}</div>
        ))}
      </div>
      <div>
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Steps</div>
        {steps.map((step, i) => (
          <div key={i} style={{ fontSize: 14, padding: '4px 0' }}>
            <span style={{ fontWeight: 'bold', color: '#e67e22' }}>{i + 1}.</span> {step}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Display a nutrition info card */
export function NutritionCard({ title, category, highlights, sources }: {
  title: string
  category: string
  highlights: string[]
  sources: string[]
}) {
  return (
    <div style={{ border: '1px solid #b8e6c1', background: '#f0faf3', borderRadius: 8, padding: 16, maxWidth: 520, fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>{category}</div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Key Points</div>
        {highlights.map((item, i) => (
          <div key={i} style={{ fontSize: 14, padding: '2px 0' }}>• {item}</div>
        ))}
      </div>
      <div>
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Top Sources</div>
        {sources.map((src, i) => (
          <div key={i} style={{ fontSize: 14, padding: '2px 0' }}>• {src}</div>
        ))}
      </div>
    </div>
  )
}

/** Display a tip or technique note */
export function TipCard({ title, content }: { title: string; content: string }) {
  return (
    <div style={{ border: '1px solid #b8daff', background: '#f0f7ff', borderRadius: 8, padding: 16, maxWidth: 520, fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{content}</div>
    </div>
  )
}

/** Display a meal plan */
export function MealPlanCard({ title, strategy, meals }: {
  title: string
  strategy: string
  meals: Array<{ label: string; description: string }>
}) {
  return (
    <div style={{ border: '1px solid #d4c5f9', background: '#f8f5ff', borderRadius: 8, padding: 16, maxWidth: 520, fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>Strategy: {strategy}</div>
      {meals.map((meal, i) => (
        <div key={i} style={{ padding: '6px 0', borderBottom: i < meals.length - 1 ? '1px solid #e8e0f7' : 'none' }}>
          <div style={{ fontWeight: 'bold', fontSize: 14 }}>{meal.label}</div>
          <div style={{ fontSize: 13, color: '#666' }}>{meal.description}</div>
        </div>
      ))}
    </div>
  )
}



// ── CLI config ──

export const replConfig = {
  functions: ['json', 'fetch'],
  components: { form: ['form'] },
  spaces: ['examples/spaces/cooking', 'examples/spaces/nutrition'],
  instruct: `You are a cooking and nutrition assistant powered by a multi-space knowledge base. Your knowledge tree spans two spaces:

- **Cooking** — cuisine traditions, cooking techniques, and dietary restrictions
- **Nutrition** — macronutrients (protein, carbs, fats), vitamins & minerals (D, iron, B12), and meal planning strategies (plate method, batch prep, calorie tracking)

When the user asks for help:
1. Start with \`ask()\` using a form component to gather their request
2. Use \`loadKnowledge()\` to load relevant knowledge from BOTH spaces as needed
3. Read the loaded content with \`await stop()\` to understand it
4. Use the utility functions (estimateCalories, scaleIngredients, buildGroceryList, formatTime) to compute values
5. Display results using the display components (RecipeCard, NutritionCard, TipCard, MealPlanCard)

Make sure to add checkpoints for using all the available functions. 
Always load knowledge BEFORE giving advice — don't make things up when the knowledge base has the answer.
Never load all files from a space — only load the specific options relevant to the user's question.`,
  maxTurns: 12,
}
