import type {
  ContainerProvider,
  CreateAppConfig,
  CreateMachineConfig,
  CreateVolumeConfig,
  App,
  Machine,
  MachineState,
  Volume,
} from '../types'
import { ContainerError } from '../types'
import { FlyClient, type FlyClientOptions } from './client'
import type { FlyMachine, FlyVolume } from './types'

const DEFAULT_WAIT_TIMEOUT_MS = 60_000
const POLL_INTERVAL_MS = 1_000

/**
 * Fly.io Machines API implementation of ContainerProvider.
 */
export class FlyioProvider implements ContainerProvider {
  private readonly client: FlyClient

  constructor(options: FlyClientOptions) {
    this.client = new FlyClient(options)
  }

  // --- Apps ---

  async createApp(config: CreateAppConfig): Promise<App> {
    const app = await this.client.createApp(config.name, config.org)
    return {
      name: app.name,
      org: app.organization.slug,
      status: app.status,
    }
  }

  async deleteApp(appName: string): Promise<void> {
    await this.client.deleteApp(appName)
  }

  // --- Machines ---

  async createMachine(config: CreateMachineConfig): Promise<Machine> {
    const fly = await this.client.createMachine(config.appName, {
      name: config.name,
      region: config.region,
      config: {
        image: config.image,
        guest: {
          cpus: config.spec.cpus,
          memory_mb: config.spec.memoryMb,
          cpu_kind: config.spec.cpuKind ?? 'shared',
        },
        env: config.env,
        mounts: config.volumes?.map((v) => ({
          volume: v.volumeId,
          path: v.path,
        })),
        services: config.services?.map((s) => ({
          internal_port: s.internalPort,
          protocol: s.protocol,
          ports: s.ports.map((p) => ({
            port: p.port,
            handlers: p.handlers,
            force_https: p.forceHttps,
          })),
        })),
        auto_destroy: config.autoDestroy,
        checks: config.checks
          ? Object.fromEntries(
              Object.entries(config.checks).map(([name, c]) => [
                name,
                {
                  type: c.type,
                  port: c.port,
                  path: c.path,
                  interval: c.intervalMs,
                  timeout: c.timeoutMs,
                  method: c.method,
                },
              ]),
            )
          : undefined,
        metadata: config.metadata,
      },
    })

    return toMachine(fly, config.appName)
  }

  async getMachine(appName: string, machineId: string): Promise<Machine> {
    const fly = await this.client.getMachine(appName, machineId)
    return toMachine(fly, appName)
  }

  async listMachines(appName: string): Promise<Machine[]> {
    const machines = await this.client.listMachines(appName)
    return machines.map((m) => toMachine(m, appName))
  }

  async startMachine(appName: string, machineId: string): Promise<void> {
    await this.client.startMachine(appName, machineId)
  }

  async stopMachine(appName: string, machineId: string): Promise<void> {
    await this.client.stopMachine(appName, machineId)
  }

  async destroyMachine(appName: string, machineId: string): Promise<void> {
    // Stop first, then destroy — Fly requires machines to be stopped before deletion
    try {
      const machine = await this.client.getMachine(appName, machineId)
      if (machine.state === 'started' || machine.state === 'starting') {
        await this.client.stopMachine(appName, machineId)
        await this.client.waitForState(appName, machineId, 'stopped', 30)
      }
    } catch {
      // Machine may already be stopped or gone — continue with destroy
    }

    await this.client.destroyMachine(appName, machineId, true)
  }

  async waitForState(
    appName: string,
    machineId: string,
    state: MachineState,
    timeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
  ): Promise<Machine> {
    const deadline = Date.now() + timeoutMs

    // Try the Fly.io native wait endpoint first
    try {
      await this.client.waitForState(
        appName,
        machineId,
        state,
        Math.ceil(timeoutMs / 1000),
      )
      return this.getMachine(appName, machineId)
    } catch {
      // Fall back to polling if the wait endpoint fails
    }

    while (Date.now() < deadline) {
      const machine = await this.getMachine(appName, machineId)
      if (machine.state === state) return machine

      if (machine.state === 'destroyed') {
        throw new ContainerError(
          `Machine ${machineId} was destroyed while waiting for state "${state}"`,
        )
      }

      await sleep(POLL_INTERVAL_MS)
    }

    throw new ContainerError(
      `Timed out waiting for machine ${machineId} to reach state "${state}"`,
    )
  }

  // --- Volumes ---

  async createVolume(config: CreateVolumeConfig): Promise<Volume> {
    const vol = await this.client.createVolume(config.appName, {
      name: config.name,
      region: config.region,
      size_gb: config.sizeGb,
    })
    return toVolume(vol, config.appName)
  }

  async deleteVolume(appName: string, volumeId: string): Promise<void> {
    await this.client.deleteVolume(appName, volumeId)
  }

  async listVolumes(appName: string): Promise<Volume[]> {
    const volumes = await this.client.listVolumes(appName)
    return volumes.map((v) => toVolume(v, appName))
  }
}

// --- Mappers ---

function toMachine(fly: FlyMachine, appName: string): Machine {
  return {
    id: fly.id,
    name: fly.name,
    appName,
    region: fly.region,
    state: fly.state as MachineState,
    image: fly.config.image,
    spec: {
      cpus: fly.config.guest?.cpus ?? 1,
      memoryMb: fly.config.guest?.memory_mb ?? 256,
      cpuKind: fly.config.guest?.cpu_kind,
    },
    createdAt: fly.created_at,
    updatedAt: fly.updated_at,
    privateIp: fly.private_ip,
    hostname: `${appName}.fly.dev`,
  }
}

function toVolume(fly: FlyVolume, appName: string): Volume {
  return {
    id: fly.id,
    name: fly.name,
    appName,
    region: fly.region,
    sizeGb: fly.size_gb,
    state: fly.state,
    createdAt: fly.created_at,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
