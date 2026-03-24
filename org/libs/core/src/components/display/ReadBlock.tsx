export interface ReadBlockProps {
  payload: Record<string, unknown>;
  blockId: string;
  decayState?: 'full' | 'keys' | 'count' | 'removed';
}

export function ReadBlock({ payload, blockId, decayState = 'full' }: ReadBlockProps) {
  const containerStyle: React.CSSProperties = {
    borderLeft: '4px solid #6b7fa3',
    borderRadius: 4,
    backgroundColor: '#f0f4f8',
    padding: '12px 16px',
    fontFamily: "'Fira Code', monospace",
    fontSize: 13,
    lineHeight: 1.6,
    color: '#2d3748',
  };

  if (decayState === 'removed') {
    return (
      <div data-block-id={blockId} style={containerStyle}>
        <span style={{ color: '#999', fontStyle: 'italic' }}>Payload removed</span>
      </div>
    );
  }

  if (decayState === 'count') {
    const count = Object.keys(payload).length;
    return (
      <div data-block-id={blockId} style={containerStyle}>
        <span style={{ color: '#6b7fa3' }}>{count} key{count !== 1 ? 's' : ''}</span>
      </div>
    );
  }

  if (decayState === 'keys') {
    const keys = Object.keys(payload);
    return (
      <div data-block-id={blockId} style={containerStyle}>
        <span style={{ color: '#6b7fa3' }}>Keys: </span>
        {keys.map((key, i) => (
          <span key={key}>
            <span style={{ color: '#4a6fa5' }}>{key}</span>
            {i < keys.length - 1 ? ', ' : ''}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div data-block-id={blockId} style={containerStyle}>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}
