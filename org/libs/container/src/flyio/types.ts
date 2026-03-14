/** Fly.io Machines API response types */

export interface FlyApp {
  id: string
  name: string
  organization: {
    name: string
    slug: string
  }
  status: string
}

export interface FlyMachineConfig {
  image: string
  env?: Record<string, string>
  guest?: {
    cpus: number
    memory_mb: number
    cpu_kind?: 'shared' | 'performance'
  }
  mounts?: Array<{
    volume: string
    path: string
  }>
  services?: Array<{
    internal_port: number
    protocol: string
    ports: Array<{
      port: number
      handlers?: string[]
      force_https?: boolean
    }>
  }>
  auto_destroy?: boolean
  checks?: Record<string, {
    type: 'http' | 'tcp'
    port: number
    path?: string
    interval?: number
    timeout?: number
    method?: string
  }>
  metadata?: Record<string, string>
}

export interface FlyMachine {
  id: string
  name: string
  state: string
  region: string
  instance_id: string
  private_ip: string
  config: FlyMachineConfig
  image_ref: {
    registry: string
    repository: string
    tag: string
    digest: string
  }
  created_at: string
  updated_at: string
  host_status?: string
}

export interface FlyVolume {
  id: string
  name: string
  app: string
  region: string
  size_gb: number
  state: string
  created_at: string
  host_status?: string
  attached_machine_id?: string | null
}

export interface FlyApiError {
  error: string
  status?: number
}
