export interface HookBlockProps {
  hookId: string;
  action: string;
  detail: string;
  blockId: string;
}

export function HookBlock({ hookId, action, detail, blockId }: HookBlockProps) {
  return (
    <div
      data-block-id={blockId}
      style={{
        borderLeft: '4px solid #805ad5',
        borderRadius: 4,
        backgroundColor: '#faf5ff',
        padding: '12px 16px',
        fontFamily: 'sans-serif',
        fontSize: 13,
        lineHeight: 1.6,
        color: '#2d3748',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, color: '#6b46c1' }}>{hookId}</span>
        <span
          style={{
            backgroundColor: '#e9d8fd',
            color: '#553c9a',
            borderRadius: 4,
            padding: '1px 8px',
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          {action}
        </span>
      </div>
      <div style={{ color: '#4a5568' }}>{detail}</div>
    </div>
  );
}
