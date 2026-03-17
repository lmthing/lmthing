import { useState } from 'react';

export interface CodeBlockProps {
  code: string;
  blockId: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function CodeBlock({ code, blockId, collapsed, onToggle }: CodeBlockProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const isCollapsed = collapsed !== undefined ? collapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  return (
    <div
      data-block-id={blockId}
      style={{
        position: 'relative',
        borderRadius: 6,
        backgroundColor: '#1e1e2e',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={handleToggle}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'none',
          border: '1px solid #555',
          borderRadius: 4,
          color: '#ccc',
          cursor: 'pointer',
          fontSize: 12,
          padding: '2px 8px',
          lineHeight: '18px',
        }}
      >
        {isCollapsed ? 'Expand' : 'Collapse'}
      </button>
      {!isCollapsed && (
        <pre
          style={{
            margin: 0,
            padding: 16,
            overflowX: 'auto',
            fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
            fontSize: 13,
            lineHeight: 1.5,
            color: '#cdd6f4',
          }}
        >
          <code>{code}</code>
        </pre>
      )}
      {isCollapsed && (
        <div
          style={{
            padding: '12px 16px',
            fontFamily: "'Fira Code', monospace",
            fontSize: 12,
            color: '#888',
          }}
        >
          Code block collapsed
        </div>
      )}
    </div>
  );
}
