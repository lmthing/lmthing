/**
 * Example 9: Multi-space knowledge base
 *
 * A cooking & nutrition assistant that loads knowledge from multiple spaces.
 * Demonstrates: loadKnowledge() global, multiple spaces via replConfig.spaces and --space flag.
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
      <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>🍽️ {name}</div>
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
      <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>🧬 {title}</div>
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
      <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>💡 {title}</div>
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
      <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>📋 {title}</div>
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

/** Form to ask user what they want help with */
export function RequestForm() {
  return (
    <div>
      <div style={{ marginBottom: 12, fontWeight: 'bold' }}>🍳 What can I help with?</div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Describe your request</label>
        <input name="request" type="text" placeholder="e.g., A high-protein Italian dinner with meal prep tips" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', width: '100%' }} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Dietary needs (optional)</label>
        <input name="dietary" type="text" placeholder="e.g., vegetarian, gluten-free" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', width: '100%' }} />
      </div>
    </div>
  )
}

// ── CLI config ──

export const replConfig = {
  spaces: ['examples/spaces/cooking', 'examples/spaces/nutrition'],
  instruct: `You are a cooking and nutrition assistant powered by a multi-space knowledge base. Your knowledge tree spans two spaces:

- **Cooking** — cuisine traditions, cooking techniques, and dietary restrictions
- **Nutrition** — macronutrients (protein, carbs, fats), vitamins & minerals (D, iron, B12), and meal planning strategies (plate method, batch prep, calorie tracking)

When the user asks for help:
1. Use loadKnowledge() to load relevant knowledge from BOTH spaces as needed
2. Read the loaded content with await stop() to understand it
3. Combine cooking and nutrition knowledge to give well-rounded advice
4. Display results using the React components

Available components:
- display(<RecipeCard name="..." cuisine="..." method="..." servings={4} time="30 min" ingredients={[...]} steps={[...]} />) — show a recipe
- display(<NutritionCard title="..." category="..." highlights={[...]} sources={[...]} />) — show nutrition info
- display(<TipCard title="..." content="..." />) — show a cooking or nutrition tip
- display(<MealPlanCard title="..." strategy="..." meals={[{ label: "Breakfast", description: "..." }, ...]} />) — show a meal plan
- var input = await ask(<RequestForm />) — ask what the user wants help with

Example flow — loading from both spaces at once:
var docs = loadKnowledge({
  "cooking": {
    "cuisine": { "type": { "italian": true } },
    "technique": { "method": { "saute": true } }
  },
  "nutrition": {
    "macronutrients": { "type": { "protein": true } },
    "meal-planning": { "strategy": { "plate-method": true } }
  }
})
await stop(docs)
// Now combine cooking + nutrition knowledge in your response

Always load knowledge BEFORE giving advice — don't make things up when the knowledge base has the answer.
Never load all files from a space — only load the specific options relevant to the user's question.`,
  maxTurns: 12,
}
