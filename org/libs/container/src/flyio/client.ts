import { ContainerError } from '../types'
import type { FlyApp, FlyMachine, FlyMachineConfig, FlyVolume } from './types'

const DEFAULT_BASE_URL = 'https://api.machines.dev/v1'

export interface FlyClientOptions {
  /** Fly.io API token */
  apiToken: string
  /** Base URL override (defaults to https://api.machines.dev/v1) */
  baseUrl?: string
}

/**
 * Low-level HTTP client for the Fly.io Machines API.
 * Uses standard fetch — works in Node, Deno, and browsers.
 */
export class FlyClient {
  private readonly apiToken: string
  private readonly baseUrl: string

  constructor(options: FlyClientOptions) {
    this.apiToken = options.apiToken
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  }

  // --- Apps ---

  async createApp(name: string, org: string): Promise<FlyApp> {
    return this.request<FlyApp>('/apps', {
      method: 'POST',
      body: { app_name: name, org_slug: org },
    })
  }

  async getApp(name: string): Promise<FlyApp> {
    return this.request<FlyApp>(`/apps/${enc(name)}`)
  }

  async deleteApp(name: string): Promise<void> {
    await this.request(`/apps/${enc(name)}`, { method: 'DELETE' })
  }

  // --- Machines ---

  async createMachine(
    appName: string,
    config: {
      name?: string
      region: string
      config: FlyMachineConfig
    },
  ): Promise<FlyMachine> {
    return this.request<FlyMachine>(`/apps/${enc(appName)}/machines`, {
      method: 'POST',
      body: config,
    })
  }

  async getMachine(appName: string, machineId: string): Promise<FlyMachine> {
    return this.request<FlyMachine>(
      `/apps/${enc(appName)}/machines/${enc(machineId)}`,
    )
  }

  async listMachines(appName: string): Promise<FlyMachine[]> {
    return this.request<FlyMachine[]>(`/apps/${enc(appName)}/machines`)
  }

  async startMachine(appName: string, machineId: string): Promise<void> {
    await this.request(
      `/apps/${enc(appName)}/machines/${enc(machineId)}/start`,
      { method: 'POST' },
    )
  }

  async stopMachine(appName: string, machineId: string): Promise<void> {
    await this.request(
      `/apps/${enc(appName)}/machines/${enc(machineId)}/stop`,
      { method: 'POST' },
    )
  }

  async destroyMachine(
    appName: string,
    machineId: string,
    force = false,
  ): Promise<void> {
    const qs = force ? '?force=true' : ''
    await this.request(
      `/apps/${enc(appName)}/machines/${enc(machineId)}${qs}`,
      { method: 'DELETE' },
    )
  }

  async waitForState(
    appName: string,
    machineId: string,
    state: string,
    timeoutSeconds = 60,
  ): Promise<void> {
    await this.request(
      `/apps/${enc(appName)}/machines/${enc(machineId)}/wait?state=${enc(state)}&timeout=${timeoutSeconds}`,
    )
  }

  // --- Volumes ---

  async createVolume(
    appName: string,
    config: { name: string; region: string; size_gb: number },
  ): Promise<FlyVolume> {
    return this.request<FlyVolume>(`/apps/${enc(appName)}/volumes`, {
      method: 'POST',
      body: config,
    })
  }

  async getVolume(appName: string, volumeId: string): Promise<FlyVolume> {
    return this.request<FlyVolume>(
      `/apps/${enc(appName)}/volumes/${enc(volumeId)}`,
    )
  }

  async listVolumes(appName: string): Promise<FlyVolume[]> {
    return this.request<FlyVolume[]>(`/apps/${enc(appName)}/volumes`)
  }

  async deleteVolume(appName: string, volumeId: string): Promise<void> {
    await this.request(
      `/apps/${enc(appName)}/volumes/${enc(volumeId)}`,
      { method: 'DELETE' },
    )
  }

  // --- Internal ---

  private async request<T = unknown>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const { method = 'GET', body } = options

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
      Accept: 'application/json',
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text()
      let message: string
      try {
        const json = JSON.parse(text)
        message = json.error ?? json.message ?? text
      } catch {
        message = text || `HTTP ${res.status}`
      }
      throw new ContainerError(message, res.status)
    }

    // Some endpoints return empty bodies (DELETE, POST /start, POST /stop)
    const text = await res.text()
    if (!text) return undefined as T

    return JSON.parse(text) as T
  }
}

function enc(value: string): string {
  return encodeURIComponent(value)
}
