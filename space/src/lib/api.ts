import { getAuthHeaders } from '@lmthing/auth'
import type { Space } from './types'

const CLOUD_URL = import.meta.env.VITE_CLOUD_URL
  || (import.meta.env.DEV ? `${window.location.protocol}//cloud.test/functions/v1` : 'https://lmthing.cloud/functions/v1')

async function fetchJSON<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
      ...opts?.headers,
    },
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error?.message || `Request failed: ${res.status}`)
  }

  return data as T
}

export async function listSpaces(): Promise<Space[]> {
  const data = await fetchJSON<{ spaces: Space[] }>(`${CLOUD_URL}/list-spaces`)
  return data.spaces
}

export async function getSpace(slug: string): Promise<Space> {
  return fetchJSON<Space>(`${CLOUD_URL}/get-space?slug=${encodeURIComponent(slug)}`)
}

export async function createSpace(input: {
  name: string
  slug: string
  description?: string
  region?: string
}): Promise<Space> {
  return fetchJSON<Space>(`${CLOUD_URL}/create-space`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateSpace(
  id: string,
  updates: Partial<Pick<Space, 'name' | 'description' | 'app_config' | 'auth_enabled' | 'custom_domain'>>,
): Promise<Space> {
  return fetchJSON<Space>(`${CLOUD_URL}/update-space`, {
    method: 'POST',
    body: JSON.stringify({ id, ...updates }),
  })
}

export async function deleteSpace(id: string): Promise<void> {
  await fetchJSON<{ success: boolean }>(`${CLOUD_URL}/delete-space`, {
    method: 'POST',
    body: JSON.stringify({ id }),
  })
}

export async function startSpace(id: string): Promise<void> {
  await fetchJSON<{ success: boolean }>(`${CLOUD_URL}/start-space`, {
    method: 'POST',
    body: JSON.stringify({ id }),
  })
}

export async function stopSpace(id: string): Promise<void> {
  await fetchJSON<{ success: boolean }>(`${CLOUD_URL}/stop-space`, {
    method: 'POST',
    body: JSON.stringify({ id }),
  })
}
