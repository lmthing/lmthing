export interface Space {
  id: string
  user_id: string
  slug: string
  name: string
  description: string | null
  fly_machine_id: string | null
  fly_app_name: string | null
  fly_volume_id: string | null
  region: string
  status: 'created' | 'provisioning' | 'running' | 'stopped' | 'failed' | 'destroyed'
  app_config: Record<string, unknown>
  auth_enabled: boolean
  custom_domain: string | null
  db_schema: string | null
  internal_key_id: string | null
  created_at: string
  updated_at: string
}

export type SpaceStatus = Space['status']
