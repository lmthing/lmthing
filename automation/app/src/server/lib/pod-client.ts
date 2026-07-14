/**
 * Pod HTTP client — adapted from sdk/org/scenarios/harness/lib/pod.mjs.
 *
 * In-cluster the app dials `http://lmthing.user-<id>.svc.cluster.local:8080` with NO
 * token (the pod has no auth; protection is network position). In local dev
 * (POD_EDGE_BASE set, e.g. https://lmthing.chat) calls carry a gateway JWT, exactly
 * as the harness does.
 */
import { config, podBaseUrl, podNeedsToken } from '../config.js'
import { mintGatewayJwt } from './gateway.js'

const TRANSIENT =
  /fetch failed|ConnectTimeout|UND_ERR|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|network|terminated|other side closed/i

async function fetchResilient(url: string, init: RequestInit, { tries = 20, waitMs = 1500 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, init)
    } catch (e) {
      const msg = `${(e as Error)?.message ?? e} ${(e as any)?.cause?.code ?? ''}`
      if (!TRANSIENT.test(msg) || attempt >= tries) throw e
      await new Promise((r) => setTimeout(r, waitMs))
    }
  }
}

export class Pod {
  constructor(private userId: string) {}

  private get base() {
    return podBaseUrl(this.userId)
  }

  private async authHeaders(): Promise<Record<string, string>> {
    if (!podNeedsToken()) return {}
    return { authorization: `Bearer ${mintGatewayJwt(this.userId)}` }
  }

  private async req<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(await this.authHeaders()),
    }
    const res = await fetchResilient(`${this.base}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    const text = await res.text()
    let parsed: unknown = text
    try {
      parsed = JSON.parse(text)
    } catch {
      /* raw */
    }
    const waking =
      res.status === 504 || (parsed && typeof parsed === 'object' && (parsed as any).waking === true)
    if (waking) throw new PodWaking(this.userId)
    if (!res.ok) {
      const err = new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`) as PodError
      err.status = res.status
      err.body = parsed
      throw err
    }
    return parsed as T
  }

  /** Raw GET returning {status, body, headers} — for proxying served-app HTML. */
  async rawGet(path: string): Promise<{ status: number; text: string; headers: Headers }> {
    const res = await fetchResilient(`${this.base}${path}`, {
      method: 'GET',
      headers: await this.authHeaders(),
    })
    return { status: res.status, text: await res.text(), headers: res.headers }
  }

  fsTree = () => this.req<{ files: string[] }>('GET', '/api/fs/tree')
  readFile = (rel: string) =>
    this.req<{ content: string }>('GET', `/api/fs/read?path=${encodeURIComponent(rel)}`)
  listProjects = () => this.req('GET', '/api/projects')
  listSpaces = (projectId: string) => this.req('GET', `/api/projects/${projectId}/spaces`)
  projectSessions = (projectId: string) => this.req('GET', `/api/projects/${projectId}/sessions`)
  sessionLedger = () => this.req('GET', '/api/session-ledger')
  appManifest = (projectId: string) => this.req('GET', `/api/projects/${projectId}/app`)
  appData = (projectId: string, table: string) =>
    this.req('GET', `/api/projects/${projectId}/app/data/${table}`)
  /** Live session trace events since seq N. */
  sessionEvents = (sessionId: string, since = 0) =>
    this.req('GET', `/api/sessions/${sessionId}/events?format=json&since=${since}`)
  sessionState = (sessionId: string) => this.req('GET', `/api/sessions/${sessionId}/state`)
}

export class PodWaking extends Error {
  constructor(public userId: string) {
    super(`pod ${userId} is waking`)
  }
}
export interface PodError extends Error {
  status: number
  body: unknown
}
