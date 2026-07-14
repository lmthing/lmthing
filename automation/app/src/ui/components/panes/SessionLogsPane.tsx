import { useEffect, useMemo, useRef, useState } from 'react'
import { useSse } from '../../lib/events.js'
import { sseUrl } from '../../lib/api.js'
import type { ScenarioData, TranscriptLine } from '../../../shared/types.js'

type Sub = 'claude' | 'pod' | 'runtime'

function attemptKey(a: { round: number; attempt: number }) {
  return `${a.round}:${a.attempt}`
}

export function SessionLogsPane({ scenario }: { scenario: ScenarioData }) {
  const [sub, setSub] = useState<Sub>('claude')
  const attempts = useMemo(
    () => Object.values(scenario.attempts).sort((a, b) => attemptKey(b).localeCompare(attemptKey(a))),
    [scenario.attempts],
  )
  const [sel, setSel] = useState<string>(attempts[0] ? attemptKey(attempts[0]) : '')
  useEffect(() => {
    if (!attempts.length) return
    if (!attempts.some((a) => attemptKey(a) === sel)) setSel(attemptKey(attempts[0]))
  }, [attempts, sel])

  const subs: [Sub, string][] = [
    ['claude', 'Claude transcript'],
    ['pod', 'pod session'],
    ['runtime', 'runtime log'],
  ]

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {subs.map(([s, label]) => (
          <button
            key={s}
            className={`px-3 py-1.5 text-xs rounded ${sub === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
            onClick={() => setSub(s)}
          >
            {label}
          </button>
        ))}
      </div>
      {sub === 'claude' && <ClaudeView scenario={scenario} attempts={attempts} sel={sel} setSel={setSel} />}
      {sub === 'pod' && <PodEventsView scenario={scenario} />}
      {sub === 'runtime' && <RuntimeLogView userId={scenario.user?.userId} />}
    </div>
  )
}

function ClaudeView({
  scenario,
  attempts,
  sel,
  setSel,
}: {
  scenario: ScenarioData
  attempts: ReturnType<typeof Object.values<ScenarioData['attempts'][string]>>
  sel: string
  setSel: (s: string) => void
}) {
  const selAttempt = attempts.find((a) => attemptKey(a) === sel)
  const [lines, setLines] = useState<TranscriptLine[]>(selAttempt?.transcript ?? [])
  const [showArt, setShowArt] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLines(selAttempt?.transcript ?? [])
  }, [sel, selAttempt])

  // Live tail: append transcript events for the selected attempt.
  useSse(`/scenarios/events/${encodeURIComponent(scenario.id)}`, {
    transcript: (data) => {
      if (attemptKey(data) === sel) {
        setLines((p) => [...p, ...data.lines])
      }
    },
  })

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [lines])

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-sm">
        <span className="text-muted-foreground">attempt:</span>
        <select
          className="bg-input border border-border rounded px-2 py-1 text-sm"
          value={sel}
          onChange={(e) => setSel(e.target.value)}
        >
          {attempts.map((a: any) => (
            <option key={attemptKey(a)} value={attemptKey(a)}>
              round {a.round} · attempt {a.attempt}
            </option>
          ))}
        </select>
        {selAttempt?.result && (
          <span className="text-muted-foreground">
            {selAttempt.result.outcome}
            {selAttempt.result.costUsd != null ? ` · $${selAttempt.result.costUsd.toFixed(2)}` : ''}
          </span>
        )}
        <button className="ml-auto text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowArt((v) => !v)}>
          {showArt ? 'hide' : 'show'} artifacts
        </button>
      </div>

      {showArt && selAttempt && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {selAttempt.outputLog && <ArtifactCard title="output.log" body={selAttempt.outputLog} />}
          {selAttempt.progressMd && <ArtifactCard title="PROGRESS.md" body={selAttempt.progressMd} />}
          {selAttempt.promptMd && <ArtifactCard title="prompt.md" body={selAttempt.promptMd.slice(0, 4000) + (selAttempt.promptMd.length > 4000 ? '\n…' : '')} />}
          {selAttempt.result && <ArtifactCard title="result.json" body={JSON.stringify(selAttempt.result, null, 2)} />}
        </div>
      )}

      <div className="border border-border rounded-lg bg-card overflow-auto" style={{ maxHeight: '60vh' }}>
        <pre className="text-xs font-mono p-3 whitespace-pre-wrap break-words">
          {lines.length === 0 ? (
            <span className="text-muted-foreground">no transcript yet</span>
          ) : (
            lines.map((l, i) => <TranscriptLineView key={i} line={l} />)
          )}
          <div ref={endRef} />
        </pre>
      </div>
    </div>
  )
}

function TranscriptLineView({ line }: { line: TranscriptLine }) {
  const t = line.type
  let color = 'text-foreground'
  let summary = ''
  if (t === 'system') {
    color = 'text-muted-foreground'
    summary = `[init] model=${(line as any).model ?? ''} session=${(line as any).session_id ?? ''}`
  } else if (t === 'assistant') {
    color = 'text-agent'
    const content = (line as any).message?.content ?? []
    const text = content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join(' ')
    const tools = content.filter((c: any) => c.type === 'tool_use').map((c: any) => c.name)
    summary = (text ? text.slice(0, 300) : '') + (tools.length ? `  ⟶ ${tools.join(', ')}` : '')
  } else if (t === 'user') {
    color = 'text-muted-foreground'
    summary = '[user]'
  } else if (t === 'result') {
    color = (line as any).subtype === 'success' ? 'text-success' : 'text-warning'
    summary = `[result] ${(line as any).subtype ?? ''} cost=${(line as any).total_cost_usd ?? ''}`
  } else {
    summary = `[${t}]`
  }
  return (
    <div className={color}>
      <span className="text-muted-foreground">›</span> {summary}
    </div>
  )
}

function PodEventsView({ scenario }: { scenario: ScenarioData }) {
  const [events, setEvents] = useState<any[]>([])
  const sid = scenario.checkpoint?.sessionId
  useSse(`/scenarios/events/${encodeURIComponent(scenario.id)}`, {
    'pod-events': (data) => setEvents((p) => [...p, ...data]),
    snapshot: () => setEvents([]),
  })
  return (
    <div className="border border-border rounded-lg bg-card overflow-auto" style={{ maxHeight: '60vh' }}>
      <div className="text-xs text-muted-foreground p-2 border-b border-border">
        THING session <code className="font-mono">{sid ?? '—'}</code> · {events.length} events
      </div>
      <pre className="text-xs font-mono p-3 whitespace-pre-wrap break-words">
        {events.length === 0 ? (
          <span className="text-muted-foreground">no pod session events (is the pod awake?)</span>
        ) : (
          events.map((e, i) => (
            <div key={i} className="text-foreground">
              <span className="text-muted-foreground">#{e.seq ?? i}</span> {e.event?.type ?? e.type ?? JSON.stringify(e).slice(0, 200)}
            </div>
          ))
        )}
      </pre>
    </div>
  )
}

function RuntimeLogView({ userId }: { userId?: string }) {
  const [lines, setLines] = useState<string[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!userId) return
    setLines([])
    let stopped = false
    let es: EventSource | null = null
    const open = () => {
      if (stopped) return
      es = new EventSource(sseUrl(`/podlogs/${userId}/stream`))
      es.addEventListener('log', (e: MessageEvent) => setLines((p) => [...p.slice(-1000), e.data]))
      es.addEventListener('error', (e: any) => {
        if (e?.data) setLines((p) => [...p.slice(-1000), `[error] ${e.data}`])
        es?.close()
        if (!stopped) setTimeout(open, 3000)
      })
      es.onerror = () => {
        es?.close()
        if (!stopped) setTimeout(open, 3000)
      }
    }
    open()
    return () => {
      stopped = true
      es?.close()
    }
  }, [userId])
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [lines])
  return (
    <div className="border border-border rounded-lg bg-card overflow-auto" style={{ maxHeight: '60vh' }}>
      <pre className="text-xs font-mono p-3 whitespace-pre-wrap break-words">
        {lines.length === 0 ? (
          <span className="text-muted-foreground">runtime log is only reachable in-cluster (k8s pods/log)</span>
        ) : (
          lines.map((l, i) => <div key={i}>{l}</div>)
        )}
        <div ref={endRef} />
      </pre>
    </div>
  )
}

function ArtifactCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-border rounded-lg bg-background overflow-hidden">
      <div className="text-xs text-muted-foreground px-2 py-1 border-b border-border bg-muted">{title}</div>
      <pre className="text-xs font-mono p-2 whitespace-pre-wrap break-words max-h-48 overflow-auto">{body}</pre>
    </div>
  )
}
