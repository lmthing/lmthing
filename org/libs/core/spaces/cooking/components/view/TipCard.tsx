import React from 'react';

/** Display a tip or technique note */

export function TipCard({ title, content }: { title: string; content: string; }) {
  return (
    <div style={{ border: '1px solid #b8daff', background: '#f0f7ff', borderRadius: 8, padding: 16, maxWidth: 520, fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{content}</div>
    </div>
  );
}
