/**
 * k8s API helper — adapted from cloud/gateway/src/lib/compute.ts `k8s()`.
 * Reads the in-cluster service-account token. Used only for `pods/log` (container
 * stdout = the lmthing runtime log); file/session/app access goes over pod HTTP.
 */
import { readFileSync } from 'node:fs'

const K8S_API =
  process.env.K8S_API_URL ??
  (process.env.KUBERNETES_SERVICE_HOST
    ? `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`
    : '')

const TOKEN_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/token'

function authHeaders(): Record<string, string> {
  try {
    return { Authorization: `Bearer ${readFileSync(TOKEN_PATH, 'utf-8').trim()}` }
  } catch {
    return {}
  }
}

export function k8sAvailable(): boolean {
  return !!K8S_API && !!authHeaders().Authorization
}

/** List pods in a user namespace (to find the pod name for logs). */
export async function listPods(userId: string): Promise<{ name: string }[]> {
  if (!K8S_API) return []
  const res = await fetch(`${K8S_API}/api/v1/namespaces/user-${userId}/pods`, {
    headers: { ...authHeaders() },
  })
  if (!res.ok) return []
  const json = (await res.json()) as any
  return (json?.items ?? []).map((it: any) => ({ name: it.metadata?.name }))
}

/**
 * Stream container stdout lines. Calls onLine for each line, resolves when the stream
 * ends (tail mode) or the abort signal fires. `sinceSeconds` fetches recent history.
 */
export async function streamPodLogs(
  userId: string,
  opts: { tail?: number; sinceSeconds?: number; follow?: boolean },
  onLine: (line: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!K8S_API) throw new Error('k8s API unavailable (not in-cluster)')
  const pods = await listPods(userId)
  if (!pods.length) throw new Error(`no pods in user-${userId}`)
  const pod = pods[0].name
  const params = new URLSearchParams({
    container: 'compute',
    timestamps: 'true',
  })
  if (opts.tail) params.set('tailLines', String(opts.tail))
  if (opts.sinceSeconds) params.set('sinceSeconds', String(opts.sinceSeconds))
  if (opts.follow) params.set('follow', 'true')
  const url = `${K8S_API}/api/v1/namespaces/user-${userId}/pods/${pod}/log?${params}`
  const res = await fetch(url, { headers: { ...authHeaders() }, signal })
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => '')
    throw new Error(`pods/log → ${res.status}: ${t.slice(0, 200)}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) if (line) onLine(line)
  }
  if (buf) onLine(buf)
}
