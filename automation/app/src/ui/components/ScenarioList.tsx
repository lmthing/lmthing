import { useEffect, useState } from 'react'
import { api, sseUrl } from '../lib/api.js'
import { detailHref, navigate } from '../lib/router.js'

interface ListRow {
  id: string
  round?: number
  user?: { userId?: string; label?: string }
  checkpoint?: { projectId?: string; sessionId?: string; done?: boolean; summary?: { total?: number; passed?: number; issues?: number } }
  attempts: number
  updatedAt: number
}
interface ListResp {
  campaign: { tasks: Record<string, { round: number }>; runs: any[]; updatedAt?: string } | null
  runtime: any
  scenarios: ListRow[]
}

function lastRun(campaign: ListResp['campaign'], id: string): any | null {
  const runs = (campaign?.runs ?? []).filter((r) => r.task === id)
  if (!runs.length) return null
  return runs[runs.length - 1]
}

function slotFor(runtime: any, id: string): any | null {
  return (runtime?.slots ?? []).find((s: any) => s.task === id) ?? null
}

function outcomeColor(o?: string): string {
  if (!o) return 'text-muted-foreground'
  if (o === 'done') return 'text-success'
  if (o === 'running') return 'text-agent'
  if (o === 'error') return 'text-destructive'
  return 'text-warning'
}

export function ScenarioList() {
  const [data, setData] = useState<ListResp | null>(null)
  const [statuses, setStatuses] = useState<Record<string, any>>({})

  const refresh = () => api<ListResp>('/scenarios').then(setData).catch(() => {})

  useEffect(() => {
    refresh()
    const es = new EventSource(sseUrl('/scenarios/events/*'))
    es.addEventListener('campaign', refresh)
    es.addEventListener('runtime', refresh)
    es.addEventListener('scenario-summary', refresh)
    es.onerror = () => {}
    const tick = setInterval(refresh, 5000)
    return () => {
      es.close()
      clearInterval(tick)
    }
  }, [])

  // Lazy pod-status fetch for scenarios that have a user.
  useEffect(() => {
    if (!data) return
    for (const s of data.scenarios) {
      const uid = s.user?.userId
      if (!uid || statuses[uid]) continue
      api(`/podlife/${uid}/status`)
        .then((st) => setStatuses((p) => ({ ...p, [uid!]: st })))
        .catch((e) => setStatuses((p) => ({ ...p, [uid!]: { error: e.message } })))
    }
  }, [data])

  const runtime = data?.runtime
  const campaign = data?.campaign

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <h2 className="text-lg">scenarios</h2>
        <span className="text-sm text-muted-foreground">
          {runtime?.running ? 'engine running' : runtime?.paused ? 'paused' : 'idle'}
          {runtime?.activeBin?.bin ? ` · bin ${runtime.activeBin.bin}` : ''}
        </span>
        {runtime?.slots?.some((s: any) => s.task) && (
          <span className="text-sm text-agent">
            active: {runtime.slots.filter((s: any) => s.task).map((s: any) => s.task).join(', ')}
          </span>
        )}
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-left">
            <tr>
              <th className="px-3 py-2">scenario</th>
              <th className="px-3 py-2">round</th>
              <th className="px-3 py-2">last run</th>
              <th className="px-3 py-2">cost</th>
              <th className="px-3 py-2">acts</th>
              <th className="px-3 py-2">pod</th>
            </tr>
          </thead>
          <tbody>
            {(data?.scenarios ?? []).map((s) => {
              const lr = lastRun(campaign, s.id)
              const slot = slotFor(runtime, s.id)
              const uid = s.user?.userId
              const st = uid ? statuses[uid] : undefined
              const podStage = st?.pod?.stage ?? (st?.error ? 'err' : '')
              return (
                <tr
                  key={s.id}
                  className="border-t border-border hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(detailHref(s.id))}
                >
                  <td className="px-3 py-2 font-mono">
                    {s.id}
                    {slot?.task ? <span className="ml-2 text-agent text-xs">● live</span> : null}
                  </td>
                  <td className="px-3 py-2">{s.round ?? '—'}</td>
                  <td className={`px-3 py-2 ${outcomeColor(lr?.outcome)}`}>
                    {lr?.outcome ?? '—'}
                    {lr?.subtype ? `/${lr.subtype}` : ''}
                  </td>
                  <td className="px-3 py-2">{lr?.costUsd != null ? `$${lr.costUsd.toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {s.checkpoint?.summary ? `${s.checkpoint.summary.passed}/${s.checkpoint.summary.total}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {uid ? (
                      <span className={st?.pod?.ready ? 'text-success' : ''}>
                        {podStage || '…'}
                      </span>
                    ) : (
                      'no user'
                    )}
                  </td>
                </tr>
              )
            })}
            {data && data.scenarios.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No scenarios synced yet. Is the client running?
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
