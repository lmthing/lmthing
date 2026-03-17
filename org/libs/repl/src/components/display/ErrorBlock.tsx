export interface ErrorBlockProps {
  error: {
    type: string;
    message: string;
    line: number;
    source: string;
  };
  blockId: string;
}

export function ErrorBlock({ error, blockId }: ErrorBlockProps) {
  return (
    <div
      data-block-id={blockId}
      style={{
        borderLeft: '4px solid #e53e3e',
        borderRadius: 4,
        backgroundColor: '#fff5f5',
        padding: '12px 16px',
        fontFamily: 'sans-serif',
        fontSize: 13,
        lineHeight: 1.6,
        color: '#2d3748',
      }}
    >
      <div style={{ fontWeight: 600, color: '#c53030', marginBottom: 4 }}>
        {error.type}
      </div>
      <div style={{ marginBottom: 8, color: '#742a2a' }}>
        {error.message}
      </div>
      <div
        style={{
          backgroundColor: '#fed7d7',
          borderRadius: 4,
          padding: '8px 12px',
          fontFamily: "'Fira Code', monospace",
          fontSize: 12,
          color: '#9b2c2c',
        }}
      >
        <span style={{ color: '#c53030', marginRight: 8 }}>Line {error.line}:</span>
        {error.source}
      </div>
    </div>
  );
}
