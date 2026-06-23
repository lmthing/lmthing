/**
 * podSpaces — Pod project-space API client
 *
 * Mirrors studio/src/lib/github/workspaceLoader.ts in role:
 * reads/writes spaces from the user's compute pod via the REST API
 * exposed by `lmthing serve` (Part 1b of the CLI refactor).
 *
 * Auth: gateway JWT via `Authorization: Bearer <accessToken>`.
 * Base URL: VITE_COMPUTER_BASE_URL (same as ReplRpcClient.syncSpace).
 */

export const COMPUTER_BASE_URL =
  import.meta.env.VITE_COMPUTER_BASE_URL ??
  (import.meta.env.DEV ? 'https://computer.test' : 'https://lmthing.computer')

// ── Types from the pod REST API ───────────────────────────────────────────────

export interface PodProject {
  id: string
  name: string
  createdAt: string
}

export interface PodSpaceMeta {
  id: string
  name: string
  description?: string
  agents?: string[]
  /** File / agent counts — shape may vary; treat as informational. */
  counts?: Record<string, number>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function podHeaders(accessToken: string): HeadersInit {
  return { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' }
}

async function podFetch<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...podHeaders(accessToken), ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    throw new Error(`Pod API ${init?.method ?? 'GET'} ${url} failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * List all projects visible on the pod.
 * Returns at least the implicit `user` project.
 */
export async function listProjects(
  accessToken: string,
  baseUrl = COMPUTER_BASE_URL,
): Promise<PodProject[]> {
  const data = await podFetch<{ projects: PodProject[] }>(
    `${baseUrl}/api/projects`,
    accessToken,
  )
  return data.projects
}

/**
 * List spaces within a pod project (metadata only — no file content).
 */
export async function listPodSpaces(
  projectId: string,
  accessToken: string,
  baseUrl = COMPUTER_BASE_URL,
): Promise<PodSpaceMeta[]> {
  const data = await podFetch<{ spaces: PodSpaceMeta[] }>(
    `${baseUrl}/api/projects/${encodeURIComponent(projectId)}/spaces`,
    accessToken,
  )
  return data.spaces
}

/**
 * Load all files for a single pod space.
 * Returns a flat `Record<relPath, content>` mapping — relative to the space root.
 * Strips runtime-only files (conversations/, .env*) via `isRunnableSpaceFile`.
 */
export async function loadPodSpace(
  projectId: string,
  spaceId: string,
  accessToken: string,
  baseUrl = COMPUTER_BASE_URL,
): Promise<Record<string, string>> {
  const data = await podFetch<{ files: Record<string, string> }>(
    `${baseUrl}/api/projects/${encodeURIComponent(projectId)}/spaces/${encodeURIComponent(spaceId)}/files`,
    accessToken,
  )
  return data.files
}

/**
 * Write a file map back to a pod space (wipe-and-rewrite).
 * Filters with `isRunnableSpaceFile` so conversation history and .env files
 * are never sent to the pod from the editor.
 */
export async function savePodSpace(
  projectId: string,
  spaceId: string,
  fileMap: Record<string, string>,
  accessToken: string,
  baseUrl = COMPUTER_BASE_URL,
): Promise<void> {
  const filtered: Record<string, string> = {}
  for (const [path, content] of Object.entries(fileMap)) {
    if (isRunnableSpaceFile(path)) filtered[path] = content
  }
  await podFetch<unknown>(
    `${baseUrl}/api/projects/${encodeURIComponent(projectId)}/spaces/${encodeURIComponent(spaceId)}/files`,
    accessToken,
    { method: 'PUT', body: JSON.stringify({ files: filtered }) },
  )
}

/**
 * Files that belong to the editor VFS but must NOT be sent back to the pod.
 * Mirrors the same filter used in the agent chat route.
 */
export function isRunnableSpaceFile(path: string): boolean {
  if (path.includes('/conversations/')) return false
  const base = path.split('/').pop() ?? ''
  if (base.startsWith('.env')) return false
  return true
}
