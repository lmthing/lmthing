/**
 * Example 9: Space with knowledge base
 *
 * A cooking assistant that loads knowledge from a space's knowledge/ directory.
 * Demonstrates: loadKnowledge() global, space loading via --space flag.
 *
 * The bundled space at examples/spaces/cooking/ contains:
 *   - cuisine/type: Italian, Japanese, Mexican
 *   - technique/method: Sauté, Braise, Grill
 *   - dietary/restriction: Vegetarian, Gluten-Free, Dairy-Free
 *
 * Run:
 *   npx tsx src/cli/bin.ts examples/09-space.tsx --space examples/spaces/cooking -m openai:gpt-4o-mini
 *   npx tsx src/cli/bin.ts examples/09-space.tsx --space examples/spaces/cooking -m openai:gpt-4o-mini -d debug-run.xml
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

/** Display a tip or technique note */
export function TipCard({ title, content }: { title: string; content: string }) {
  return (
    <div style={{ border: '1px solid #b8daff', background: '#f0f7ff', borderRadius: 8, padding: 16, maxWidth: 520, fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>💡 {title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{content}</div>
    </div>
  )
}

/** Form to ask user what they want to cook */
export function CookingRequestForm() {
  return (
    <div>
      <div style={{ marginBottom: 12, fontWeight: 'bold' }}>🍳 What would you like to cook?</div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Describe your request</label>
        <input name="request" type="text" placeholder="e.g., A quick Italian pasta dish" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', width: '100%' }} />
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
  instruct: `You are a cooking assistant powered by a knowledge base. Your knowledge tree shows the available cuisine, technique, and dietary information.

When the user asks about cooking:
1. Use loadKnowledge() to load the relevant cuisine, technique, and/or dietary knowledge
2. Read the loaded content with await stop() to understand it
3. Use the knowledge to provide informed, specific guidance
4. Display results using the React components

Available components:
- display(<RecipeCard name="..." cuisine="..." method="..." servings={4} time="30 min" ingredients={[...]} steps={[...]} />) — show a recipe
- display(<TipCard title="..." content="..." />) — show a cooking tip
- var input = await ask(<CookingRequestForm />) — ask what the user wants to cook

Example flow:
var docs = loadKnowledge({ "cuisine": { "type": { "italian": true } }, "technique": { "method": { "saute": true } } })
await stop(docs)
// Now use the loaded knowledge to generate a recipe or give advice

Always load knowledge BEFORE giving advice — don't make things up when the knowledge base has the answer.`,
  maxTurns: 12,
}
