import { useState } from 'react'

interface StructuredOutputDisplayProps {
  data: Record<string, unknown>
}

function RenderValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const indent = depth * 1.25

  if (value === null || value === undefined) {
    return <span style={{ color: 'var(--color-muted, #94a3b8)', fontStyle: 'italic' }}>null</span>
  }

  if (typeof value === 'boolean') {
    return <span style={{ color: 'var(--color-primary, #8b5cf6)' }}>{String(value)}</span>
  }

  if (typeof value === 'number') {
    return <span style={{ color: 'var(--color-warning, #f59e0b)' }}>{value}</span>
  }

  if (typeof value === 'string') {
    return <span style={{ color: 'var(--color-success, #10b981)' }}>"{value}"</span>
  }

  if (Array.isArray(value)) {
    return <CollapsibleBlock label={`Array(${value.length})`} depth={depth}>
      {value.map((item, idx) => (
        <div key={idx} style={{ paddingLeft: `${indent + 1.25}rem` }}>
          <span style={{ color: 'var(--color-muted, #94a3b8)', marginRight: '0.5rem' }}>{idx}:</span>
          <RenderValue value={item} depth={depth + 1} />
        </div>
      ))}
    </CollapsibleBlock>
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    return <CollapsibleBlock label={`{${entries.length}}`} depth={depth}>
      {entries.map(([key, val]) => (
        <div key={key} style={{ paddingLeft: `${indent + 1.25}rem` }}>
          <span style={{ color: 'var(--color-info, #06b6d4)', marginRight: '0.5rem' }}>{key}:</span>
          <RenderValue value={val} depth={depth + 1} />
        </div>
      ))}
    </CollapsibleBlock>
  }

  return <span>{String(value)}</span>
}

function CollapsibleBlock({ label, depth, children }: { label: string; depth: number; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(depth < 2)

  return (
    <span>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-muted, #94a3b8)',
          fontSize: '0.75rem',
          padding: 0,
        }}
      >
        {expanded ? '▼' : '▶'} {label}
      </button>
      {expanded && <div>{children}</div>}
    </span>
  )
}

export function StructuredOutputDisplay({ data }: StructuredOutputDisplayProps) {
  return (
    <div style={{
      fontFamily: 'monospace',
      fontSize: '0.75rem',
      lineHeight: 1.6,
      padding: '0.75rem',
      borderRadius: '0.375rem',
      backgroundColor: 'var(--color-bg-elevated, #f8fafc)',
      border: '1px solid var(--color-border)',
      maxHeight: '24rem',
      overflow: 'auto',
    }}>
      <RenderValue value={data} depth={0} />
    </div>
  )
}
