import React from 'react';

/** Display a nutrition info card */

export function NutritionCard({ title, category, highlights, sources }: {
  title: string;
  category: string;
  highlights: string[];
  sources: string[];
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
  );
}
