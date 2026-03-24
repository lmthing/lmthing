import React from 'react';

// ── React Components ──
/** Display a recipe card */

export function RecipeCard({ name, cuisine, method, servings, time, ingredients, steps }: {
  name: string;
  cuisine: string;
  method: string;
  servings: number;
  time: string;
  ingredients: string[];
  steps: string[];
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
  );
}
