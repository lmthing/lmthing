/** Region identifier (e.g. "iad", "lhr", "sjc") */
export type Region = string

/** Machine lifecycle states */
export type MachineState =
  | 'created'
  | 'starting'
  | 'started'
  | 'stopping'
  | 'stopped'
  | 'replacing'
  | 'destroying'
  | 'destroyed'

/** Machine size presets */
export interface MachineSpec {
  cpus: number
  memoryMb: number
  cpuKind?: 'shared' | 'performance'
}

/** Configuration for creating a new machine */
export interface CreateMachineConfig {
  /** App the machine belongs to */
  appName: string
  /** Display name for the machine */
  name?: string
  /** Deployment region */
  region: Region
  /** Docker image to run */
  image: string
  /** Machine size */
  spec: MachineSpec
  /** Environment variables */
  env?: Record<string, string>
  /** Volumes to attach */
  volumes?: MountConfig[]
  /** Services (port mappings) */
  services?: ServiceConfig[]
  /** Auto-destroy on exit */
  autoDestroy?: boolean
  /** Health checks */
  checks?: Record<string, HealthCheck>
  /** Metadata */
  metadata?: Record<string, string>
}

/** Machine health check configuration */
export interface HealthCheck {
  /** Check type */
  type: 'http' | 'tcp'
  /** Port to check */
  port: number
  /** HTTP path (for http type) */
  path?: string
  /** Interval between checks in milliseconds */
  intervalMs?: number
  /** Timeout for each check in milliseconds */
  timeoutMs?: number
  /** HTTP method (for http type) */
  method?: string
}

/** Volume mount configuration */
export interface MountConfig {
  volumeId: string
  path: string
}

/** Service / port mapping */
export interface ServiceConfig {
  /** Internal port the app listens on */
  internalPort: number
  /** Protocol */
  protocol: 'tcp' | 'udp'
  /** External port mappings */
  ports: Array<{
    port: number
    handlers?: string[]
    forceHttps?: boolean
  }>
}

/** Provisioned machine info */
export interface Machine {
  id: string
  name: string
  appName: string
  region: Region
  state: MachineState
  image: string
  spec: MachineSpec
  createdAt: string
  updatedAt: string
  privateIp?: string
  hostname?: string
}

/** Configuration for creating a volume */
export interface CreateVolumeConfig {
  appName: string
  name: string
  region: Region
  sizeGb: number
}

/** Provisioned volume info */
export interface Volume {
  id: string
  name: string
  appName: string
  region: Region
  sizeGb: number
  state: string
  createdAt: string
}

/** Configuration for creating an app */
export interface CreateAppConfig {
  name: string
  org: string
}

/** App info */
export interface App {
  name: string
  org: string
  status: string
}

/**
 * Abstract container orchestration interface.
 *
 * Implementations manage the full lifecycle of containerized machines:
 * apps, machines, and volumes.
 */
export interface ContainerProvider {
  // --- Apps ---
  createApp(config: CreateAppConfig): Promise<App>
  deleteApp(appName: string): Promise<void>

  // --- Machines ---
  createMachine(config: CreateMachineConfig): Promise<Machine>
  getMachine(appName: string, machineId: string): Promise<Machine>
  startMachine(appName: string, machineId: string): Promise<void>
  stopMachine(appName: string, machineId: string): Promise<void>
  destroyMachine(appName: string, machineId: string): Promise<void>
  listMachines(appName: string): Promise<Machine[]>
  waitForState(
    appName: string,
    machineId: string,
    state: MachineState,
    timeoutMs?: number,
  ): Promise<Machine>

  // --- Volumes ---
  createVolume(config: CreateVolumeConfig): Promise<Volume>
  deleteVolume(appName: string, volumeId: string): Promise<void>
  listVolumes(appName: string): Promise<Volume[]>
}

/** Error thrown by container providers */
export class ContainerError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ContainerError'
  }
}
