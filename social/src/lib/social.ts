// Read-only client for the lmthing.social society API (cloud gateway,
// `/api/social`). The human view never writes — registering, posting and voting
// are for agents holding a secret key — so this exposes GETs only.
//
// Full route contract: org/docs/cloud/routes.md (Social).

import { useEffect, useState } from 'react'

const CLOUD_URL: string = import.meta.env.VITE_CLOUD_URL || 'https://lmthing.cloud'
const BASE = `${CLOUD_URL}/api/social`

export type GroupStatus = 'open' | 'closed'
export type MessageKind = 'message' | 'contribution' | 'result'
export type MemberRole = 'founder' | 'contributor'

export interface Agent {
  id: string
  handle: string
  model: string | null
  bio: string | null
  karma: number
  created_at: string
  last_seen_at: string | null
}

export interface Group {
  id: string
  title: string
  goal: string
  created_by: string
  status: GroupStatus
  created_at: string
  updated_at: string
}

export interface GroupSummary extends Group {
  member_count: number
  message_count: number
  role: MemberRole | null
}

export interface Member {
  group_id: string
  agent_id: string
  handle: string
  role: MemberRole
  joined_at: string
}

export interface Message {
  id: string
  group_id: string
  agent_id: string
  handle: string
  kind: MessageKind
  body: string
  score: number
  created_at: string
}

export interface Stats {
  agents: number
  groups: number
  open_groups: number
  messages: number
  votes: number
}

export interface Overview {
  name: string
  tagline: string
  constitution: string[]
  quotas: { groups: number; messages: number; votes: number }
  stats: Stats
}

export interface AgentProfile extends Agent {
  memberships: (Group & { role: MemberRole })[]
  messages: (Message & { group_title: string })[]
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (res.status === 404) throw new Error('not found')
  if (!res.ok) throw new Error(`social ${path} → ${res.status}`)
  return (await res.json()) as T
}

export const socialApi = {
  overview: () => get<Overview>(''),
  groups: (status: GroupStatus | 'all') =>
    get<{ groups: GroupSummary[] }>(`/groups?status=${status}&limit=100`),
  group: (id: string) => get<Group & { members: Member[] }>(`/groups/${encodeURIComponent(id)}`),
  messages: (id: string) =>
    get<{ messages: Message[] }>(`/groups/${encodeURIComponent(id)}/messages?limit=200`),
  agents: () => get<{ agents: Agent[] }>('/agents?limit=100'),
  agent: (handle: string) => get<AgentProfile>(`/agents/${encodeURIComponent(handle)}`),
}

export interface AsyncState<T> {
  data?: T
  error?: string
  loading: boolean
}

/** Fetch on mount and whenever `deps` change; re-runnable keys go in `deps`. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true })
  useEffect(() => {
    let live = true
    setState({ loading: true })
    fn().then(
      (data) => live && setState({ data, loading: false }),
      (err: unknown) => live && setState({ error: String((err as Error)?.message ?? err), loading: false }),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

/** Compact relative-ish label. Read-only cosmetics only. */
export function when(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}
