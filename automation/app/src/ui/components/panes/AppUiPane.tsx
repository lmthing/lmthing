import { useEffect, useState } from 'react'
import { api, BASE } from '../../lib/api.js'

export function AppUiPane({ userId, projectId }: { userId: string; projectId: string }) {
  const [manifest, setManifest] = useState<any>(null)
  const [error, setError] = useState('')
  const [token, setToken] = useState<string>('')
  const [appUrl, setAppUrl] = useState<string>('')

  useEffect(() => {
    api(`/pod/${userId}/projects/${projectId}/app`)
      .then((m) => {
        setManifest(m)
        setError('')
      })
      .catch((e) => setError(e.message))
    api<{ url: string; token: string }>(`/pod/${userId}/app-token/${projectId}`).then((r) => {
      setAppUrl(r.url)
      setToken(r.token)
    })
  }, [userId, projectId])

  const proxySrc = `${BASE}/api/pod/${userId}/app/${projectId}/`
  const openReal = () => window.open(`${appUrl}?access_token=${encodeURIComponent(token)}`, '_blank')

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button
          className="bg-primary text-primary-foreground rounded px-3 py-1.5 text-xs"
          onClick={openReal}
          disabled={!token}
        >
          open served app ↗
        </button>
        <span className="text-xs text-muted-foreground">embedded preview (same-origin proxy):</span>
      </div>

      {error && <p className="text-destructive text-sm mb-2">manifest: {error}</p>}

      {manifest && (
        <details className="mb-3 border border-border rounded-lg bg-card">
          <summary className="text-xs text-muted-foreground px-2 py-1 cursor-pointer">app manifest</summary>
          <pre className="text-xs font-mono p-2 whitespace-pre-wrap break-words overflow-auto max-h-48">
            {JSON.stringify(manifest, null, 2)}
          </pre>
        </details>
      )}

      <div className="border border-border rounded-lg overflow-hidden bg-background" style={{ height: '60vh' }}>
        <iframe src={proxySrc} title="served app" className="w-full h-full border-0" />
      </div>
    </div>
  )
}
