import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useSse } from '../lib/events.js'
import { SessionLogsPane } from './panes/SessionLogsPane.js'
import { FileTreePane } from './panes/FileTreePane.js'
import { AppUiPane } from './panes/AppUiPane.js'
import type { ScenarioData } from '../../shared/types.js'

type Tab = 'logs' | 'files' | 'app'

export function ScenarioDetail({ id }: { id: string }) {
  const [sc, setSc] = useState<ScenarioData | null>(null)
  const [tab, setTab] = useState<Tab>('logs')
  const [podStatus, setPodStatus] = useState<any>(null)

  const load = () => api<ScenarioData>(`/scenarios/${encodeURIComponent(id)}`).then(setSc).catch(() => {})

  useEffect(() => {
    load()
  }, [id])

  useSse(`/scenarios/events/${encodeURIComponent(id)}`, {
    snapshot: (data) => setSc(data),
    checkpoint: () => load(),
    'scenario-md': () => load(),
    attempt: () => load(),
  })

  const userId = sc?.user?.userId
  const projectId = sc?.checkpoint?.projectId

  const refreshStatus = () => {
    if (!userId) return
    api(`/podlife/${userId}/status`).then(setPodStatus).catch(() => {})
  }
  useEffect(() => {
    refreshStatus()
  }, [userId])

  const wake = async () => {
    if (!userId) return
    setPodStatus({ pod: { stage: 'waking' } })
    await api(`/podlife/${userId}/wake`, { method: 'POST' }).catch(() => {})
    refreshStatus()
  }

  if (!sc) return <div className="text-muted-foreground">loading…</div>

  const tabs: [Tab, string][] = [
    ['logs', 'session logs'],
    ['files', 'file structure'],
    ['app', 'served app'],
  ]

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <h2 className="text-lg font-mono">{id}</h2>
        <span className="text-sm text-muted-foreground">round {sc.campaignState?.tasks?.[id]?.round ?? '?'}</span>
        <span className="text-sm text-muted-foreground">
          user <code className="font-mono">{userId ?? '—'}</code>
        </span>
        <span className="text-sm text-muted-foreground">
          project <code className="font-mono">{projectId ?? '—'}</code>
        </span>
        <span className={`text-sm ${podStatus?.pod?.ready ? 'text-success' : 'text-warning'}`}>
          pod: {podStatus?.pod?.stage ?? '—'}
        </span>
        <button
          className="ml-auto bg-secondary text-secondary-foreground rounded px-3 py-1.5 text-xs"
          onClick={wake}
          disabled={!userId}
        >
          wake pod
        </button>
      </div>

      <div className="flex gap-1 mb-3 border-b border-border">
        {tabs.map(([t, label]) => (
          <button
            key={t}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'logs' && <SessionLogsPane scenario={sc} />}
      {tab === 'files' && userId && <FileTreePane userId={userId} />}
      {tab === 'app' && userId && projectId && <AppUiPane userId={userId} projectId={projectId} />}
      {tab === 'app' && (!userId || !projectId) && (
        <div className="text-muted-foreground text-sm">No checkpoint yet — the served app is unknown until a run provisions one.</div>
      )}
    </div>
  )
}
