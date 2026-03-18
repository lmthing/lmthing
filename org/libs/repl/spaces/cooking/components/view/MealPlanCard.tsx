import React from 'react';

/** Display a meal plan */

export function MealPlanCard({ title, strategy, meals }: {
  title: string;
  strategy: string;
  meals: Array<{ label: string; description: string; }>;
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
  );
}
