// src/lib/pod/transport.ts

import type { PodProject, PodSpaceMeta, FileTree } from '../../types/project'

/**
 * Options for constructing a {@link PodTransport}.
 *
 * The transport deliberately knows nothing about auth tokens beyond how to
 * fetch one — `getAccessToken` is invoked per request so a refreshing session
 * (injected by the host app) always supplies a live token. `@lmthing/state`
 * therefore has no dependency on `@lmthing/auth`.
 */
export interface PodTransportOptions {
  /** Base URL of the compute pod's REST API (no trailing slash), e.g. `https://lmthing.computer`. */
  baseUrl: string
  /** Returns the current access token (JWT). Called immediately before each request. */
  getAccessToken: () => string | null | undefined
}

/**
 * Files that belong to the editor VFS but must NOT be sent back to the pod.
 * Mirrors the same filter used in the agent chat route and the pod's own
 * `readSpaceFiles` (which already strips `conversations/` and `.env`).
 */
export function isRunnableSpaceFile(path: string): boolean {
  if (path.includes('/conversations/')) return false
  const base = path.split('/').pop() ?? ''
  if (base.startsWith('.env')) return false
  return true
}

/**
 * Thin wrapper over the pod's project/space REST API
 * (`sdk/org/packages/cli/src/server/serve.ts`).
 *
 * File I/O is whole-space granularity: a space's full file map is loaded on
 * entry and coalesced back via a wipe-and-rewrite PUT. There is no per-file or
 * watch channel — callers (the React providers) hydrate a space into AppFS on
 * mount and debounced-write it back on change.
 */
export class PodTransport {
  constructor(private readonly opts: PodTransportOptions) {}

  // ── Internal ───────────────────────────────────────────────────────────────

  private headers(): HeadersInit {
    const token = this.opts.getAccessToken()
    const auth = token ? { authorization: `Bearer ${token}` } : {}
    return { ...auth, 'content-type': 'application/json' }
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: { ...this.headers(), ...(init?.headers ?? {}) },
    })
    if (!res.ok) {
      let body = ''
      try {
        body = await res.text()
      } catch {
        /* ignore */
      }
      throw new Error(
        `Pod API ${init?.method ?? 'GET'} ${url} failed: ${res.status}${body ? ` — ${body}` : ''}`,
      )
    }
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  private spacesUrl(projectId: string, spaceId?: string, files?: boolean): string {
    const base = `${this.opts.baseUrl}/api/projects/${encodeURIComponent(projectId)}/spaces`
    if (!spaceId) return base
    const withSpace = `${base}/${encodeURIComponent(spaceId)}`
    return files ? `${withSpace}/files` : withSpace
  }

  // ── Projects ───────────────────────────────────────────────────────────────

  /** `GET /api/projects` → `{ projects: PodProject[] }`. */
  async listProjects(): Promise<PodProject[]> {
    const data = await this.request<{ projects: PodProject[] }>(
      `${this.opts.baseUrl}/api/projects`,
    )
    return data.projects
  }

  /** `POST /api/projects { name }` → `{ id }` (HTTP 201). */
  async createProject(name: string): Promise<{ id: string }> {
    return this.request<{ id: string }>(`${this.opts.baseUrl}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  }

  /** `DELETE /api/projects/:id` (HTTP 204). */
  async deleteProject(id: string): Promise<void> {
    await this.request<void>(`${this.opts.baseUrl}/api/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  }

  // ── Spaces ─────────────────────────────────────────────────────────────────

  /** `GET /api/projects/:id/spaces` → `{ spaces: PodSpaceMeta[] }`. */
  async listSpaces(projectId: string): Promise<PodSpaceMeta[]> {
    const data = await this.request<{ spaces: PodSpaceMeta[] }>(this.spacesUrl(projectId))
    return data.spaces
  }

  /**
   * `GET /api/projects/:id/spaces/:spaceId/files` → `{ files }`.
   * Returns a flat `Record<relPath, content>` relative to the space root.
   * The pod already strips `conversations/` and `.env`; this is additionally
   * filtered with {@link isRunnableSpaceFile} defensively.
   */
  async loadSpaceFiles(projectId: string, spaceId: string): Promise<FileTree> {
    const data = await this.request<{ files: FileTree }>(
      this.spacesUrl(projectId, spaceId, true),
    )
    const filtered: FileTree = {}
    for (const [path, content] of Object.entries(data.files ?? {})) {
      if (isRunnableSpaceFile(path)) filtered[path] = content
    }
    return filtered
  }

  /**
   * `PUT /api/projects/:id/spaces/:spaceId/files { files }` (wipe-and-rewrite).
   * Filters with {@link isRunnableSpaceFile} so conversation history and `.env`
   * files are never sent back to the pod from the editor.
   */
  async saveSpaceFiles(projectId: string, spaceId: string, files: FileTree): Promise<void> {
    const filtered: FileTree = {}
    for (const [path, content] of Object.entries(files)) {
      if (isRunnableSpaceFile(path)) filtered[path] = content
    }
    await this.request<{ ok: boolean }>(this.spacesUrl(projectId, spaceId, true), {
      method: 'PUT',
      body: JSON.stringify({ files: filtered }),
    })
  }

  // ── Raw filesystem (IDE file tree) ────────────────────────────────────────

  /** `GET /api/fs/tree` → `{ files: string[] }` — all file paths relative to pod workspace root. */
  async listFiles(): Promise<string[]> {
    const data = await this.request<{ files: string[] }>(`${this.opts.baseUrl}/api/fs/tree`)
    return data.files
  }

  /** `GET /api/fs/read?path=<encoded>` → `{ content: string }`. */
  async readFile(path: string): Promise<string> {
    const data = await this.request<{ content: string }>(
      `${this.opts.baseUrl}/api/fs/read?path=${encodeURIComponent(path)}`,
    )
    return data.content
  }

  /** `PUT /api/fs/write` `{ path, content }` — write a file at `path`. */
  async writeFile(path: string, content: string): Promise<void> {
    await this.request<{ ok: boolean }>(`${this.opts.baseUrl}/api/fs/write`, {
      method: 'PUT',
      body: JSON.stringify({ path, content }),
    })
  }

  /**
   * Open a per-terminal WebSocket at `WS /api/terminals/:termId`.
   * Returns an object matching the `TerminalSession` interface: `id`, `write`,
   * `onData`, `resize`, `dispose`. PTY output arrives as raw text frames;
   * input and resize are sent as JSON control frames.
   */
  connectTerminal(command?: string): {
    id: string
    write(data: string): void
    onData(cb: (data: string) => void): () => void
    resize(cols: number, rows: number): void
    dispose(): void
  } {
    const token = this.opts.getAccessToken()
    const wsBase = this.opts.baseUrl.replace(/^http/, 'ws')
    const termId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const params = new URLSearchParams()
    if (token) params.set('access_token', token)
    if (command) params.set('command', command)
    const ws = new WebSocket(`${wsBase}/api/terminals/${termId}?${params}`)
    const dataListeners = new Set<(data: string) => void>()

    ws.onmessage = (e: MessageEvent) => {
      const data = typeof e.data === 'string' ? e.data : ''
      for (const cb of dataListeners) cb(data)
    }

    return {
      id: termId,
      write: (d: string) => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'input', data: d }))
      },
      onData: (cb: (data: string) => void) => {
        dataListeners.add(cb)
        return () => { dataListeners.delete(cb) }
      },
      resize: (cols: number, rows: number) => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      },
      dispose: () => {
        dataListeners.clear()
        ws.close()
      },
    }
  }
}
