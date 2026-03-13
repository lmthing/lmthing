/**
 * SettingsView - Space settings panel (env files, package.json).
 * Uses new hooks from Phase 3 and element components.
 */
import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from '@tanstack/react-router'
import { Shield, FileCode2 } from 'lucide-react'
import { buildSpacePathFromParams } from '@/lib/space-url'
import '@lmthing/css/elements/forms/button/index.css'
import '@lmthing/css/elements/forms/input/index.css'
import '@lmthing/css/elements/content/panel/index.css'
import '@lmthing/css/elements/layouts/page/index.css'
import '@lmthing/css/components/shell/index.css'
import { Page, PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { useUIState } from '@lmthing/state'
import { useFile } from '@lmthing/ui/hooks/fs/useFile'
import { cn } from '@lmthing/ui/lib/utils'

interface SettingsViewProps {
  isOpen: boolean
}

function useSpacePath(): string {
  const { username, studioId, storageId, spaceId } = useParams({ strict: false }) as { username?: string; studioId?: string; storageId?: string; spaceId?: string }
  if (username && studioId && storageId && spaceId) {
    return buildSpacePathFromParams(username, studioId, storageId, spaceId)
  }
  return '/'
}

export function SettingsView({ isOpen }: SettingsViewProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { spaceId } = useParams({ strict: false }) as { spaceId?: string }
  const spacePath = useSpacePath()

  const packageJsonContent = useFile('package.json')

  const packageJson = useMemo(() => {
    if (!packageJsonContent) return null
    try { return JSON.parse(packageJsonContent) } catch { return null }
  }, [packageJsonContent])

  const activeTab = useMemo(() => {
    if (pathname.includes('/settings/packages')) return 'packages'
    return 'env'
  }, [pathname])

  const handleTabChange = (tab: 'env' | 'packages') => {
    navigate({ to: `${spacePath}/settings/${tab}` })
  }

  const packageJsonSerialized = useMemo(
    () => packageJson ? JSON.stringify(packageJson, null, 2) : '',
    [packageJson]
  )

  const [packageJsonDraft, setPackageJsonDraft] = useUIState('settings-view.package-json-draft', packageJsonSerialized)
  const [packageJsonError, setPackageJsonError] = useUIState<string | null>('settings-view.package-json-error', null)
  const [packageJsonSavedAt, setPackageJsonSavedAt] = useUIState<string | null>('settings-view.package-json-saved-at', null)

  const [selectedEnvFile, setSelectedEnvFile] = useUIState('settings-view.selected-env-file', '.env.local')
  const [envPassword, setEnvPassword] = useUIState('settings-view.env-password', '')
  const [envContent, setEnvContent] = useUIState('settings-view.env-content', '')
  const [envStatus, setEnvStatus] = useUIState<string | null>('settings-view.env-status', null)
  const [envError, _setEnvError] = useUIState<string | null>('settings-view.env-error', null)

  useEffect(() => {
    setPackageJsonDraft(packageJsonSerialized)
  }, [packageJsonSerialized])

  if (!isOpen) return null

  return (
    <Page full>
      <PageHeader>
        <Stack row className="settings-view__header">
          <div>
            <Heading level={2}>Space Settings</Heading>
            <Caption muted>{spaceId || 'No space selected'}</Caption>
          </div>
        </Stack>
      </PageHeader>

      <div className="settings-view__tabs">
        <button
          onClick={() => handleTabChange('env')}
          className={`btn btn--ghost settings-view__tab ${activeTab === 'env' ? 'settings-view__tab--active' : 'settings-view__tab--inactive'}`}
        >
          <Shield className="settings-view__tab-icon" /> Environment
        </button>
        <button
          onClick={() => handleTabChange('packages')}
          className={`btn btn--ghost settings-view__tab ${activeTab === 'packages' ? 'settings-view__tab--active' : 'settings-view__tab--inactive'}`}
        >
          <FileCode2 className="settings-view__tab-icon" /> package.json
        </button>
      </div>

      <PageBody>
        {activeTab === 'env' && (
          <div className="settings-view__panel-container">
            <div className={cn('panel', 'settings-view__panel-container--env')}>
              <div className="panel__header"><span>Environment Variables</span></div>
              <div className="panel__body">
                <div className="settings-view__env-grid">
                  <div>
                    <label className="settings-view__env-label">File</label>
                    <input className="input" value={selectedEnvFile} onChange={e => setSelectedEnvFile(e.target.value)} />
                  </div>
                  <div>
                    <label className="settings-view__env-label">Password</label>
                    <input className="input" type="password" value={envPassword} onChange={e => setEnvPassword(e.target.value)} placeholder="Enter password" />
                  </div>
                </div>
                <div>
                  <label className="settings-view__env-label">Variables</label>
                  <textarea
                    className={cn('input', 'settings-view__env-textarea')}
                    value={envContent}
                    onChange={e => setEnvContent(e.target.value)}
                    placeholder="KEY=value"
                  />
                </div>
                <div className="settings-view__env-actions">
                  <button className="btn btn--outline" onClick={() => setEnvStatus('Loaded from session')}>Load</button>
                  <button className="btn btn--primary" onClick={() => setEnvStatus('Saved')}>Save</button>
                </div>
                {envError && <Caption className="settings-view__status--error">{envError}</Caption>}
                {envStatus && <Caption className="settings-view__status--success">{envStatus}</Caption>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'packages' && (
          <div className="settings-view__panel-container">
            <div className="panel">
              <div className="panel__header"><span>package.json</span></div>
              <div className="panel__body">
                <Caption muted className="settings-view__pkg-caption">
                  Inline metadata and dependency editor. Save when ready.
                </Caption>
                <textarea
                  className={cn('input', 'settings-view__pkg-textarea')}
                  value={packageJsonDraft || packageJsonSerialized}
                  onChange={e => { setPackageJsonDraft(e.target.value); setPackageJsonError(null); setPackageJsonSavedAt(null) }}
                  spellCheck={false}
                />
                <div className="settings-view__pkg-footer">
                  <Caption muted>
                    {packageJsonError ? <span className="settings-view__pkg-error">{packageJsonError}</span>
                    : packageJsonSavedAt ? `Saved at ${packageJsonSavedAt}` : 'Ready to save'}
                  </Caption>
                  <button className="btn btn--primary" onClick={() => {
                    try {
                      JSON.parse(packageJsonDraft || packageJsonSerialized)
                      setPackageJsonError(null)
                      setPackageJsonSavedAt(new Date().toLocaleTimeString())
                    } catch {
                      setPackageJsonError('Invalid JSON format.')
                    }
                  }}>Save package.json</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </PageBody>
    </Page>
  )
}
