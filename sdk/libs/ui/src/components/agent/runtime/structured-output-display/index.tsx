import '@lmthing/css/components/agent/runtime/index.css'
import { useState } from 'react'

interface StructuredOutputDisplayProps {
  data: Record<string, unknown>
}

function RenderValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const indent = depth * 1.25

  if (value === null || value === undefined) {
    return <span className="structured-output__null">null</span>
  }

  if (typeof value === 'boolean') {
    return <span className="structured-output__boolean">{String(value)}</span>
  }

  if (typeof value === 'number') {
    return <span className="structured-output__number">{value}</span>
  }

  if (typeof value === 'string') {
    return <span className="structured-output__string">"{value}"</span>
  }

  if (Array.isArray(value)) {
    return <CollapsibleBlock label={`Array(${value.length})`} depth={depth}>
      {value.map((item, idx) => (
        <div key={idx} style={{ paddingLeft: `${indent + 1.25}rem` }}>
          <span className="structured-output__index">{idx}:</span>
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
          <span className="structured-output__key">{key}:</span>
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
        className="structured-output__collapse-btn"
      >
        {expanded ? '▼' : '▶'} {label}
      </button>
      {expanded && <div>{children}</div>}
    </span>
  )
}

export function StructuredOutputDisplay({ data }: StructuredOutputDisplayProps) {
  return (
    <div className="structured-output">
      <RenderValue value={data} depth={0} />
    </div>
  )
}
