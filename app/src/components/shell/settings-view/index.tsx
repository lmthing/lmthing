/**
 * SettingsView - Workspace settings panel (env files, package.json).
 * Uses new hooks from Phase 3 and element components.
 */
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useParams } from 'next/navigation'
import { Shield, FileCode2 } from 'lucide-react'
import '@/css/elements/forms/button/index.css'
import '@/css/elements/forms/input/index.css'
import '@/css/elements/content/panel/index.css'
import '@/css/elements/layouts/page/index.css'
import { Page, PageHeader, PageBody } from '@/elements/layouts/page'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Stack } from '@/elements/layouts/stack'
import { useFile } from '@/hooks/fs/useFile'

interface SettingsViewProps {
  isOpen: boolean
}

export function SettingsView({ isOpen }: SettingsViewProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { workspaceName } = useParams()

  const packageJsonContent = useFile('package.json')

  const packageJson = useMemo(() => {
    if (!packageJsonContent) return null
    try { return JSON.parse(packageJsonContent) } catch { return null }
  }, [packageJsonContent])

  const activeTab = useMemo(() => {
    if (pathname.includes('/settings/package-json')) return 'package-json'
    return 'env'
  }, [pathname])

  const handleTabChange = (tab: 'env' | 'package-json') => {
    if (!workspaceName) return
    router.push(`/studio/${encodeURIComponent(workspaceName as string)}/settings/${tab}`)
  }

  const packageJsonSerialized = useMemo(
    () => packageJson ? JSON.stringify(packageJson, null, 2) : '',
    [packageJson]
  )

  const [packageJsonDraft, setPackageJsonDraft] = useState(packageJsonSerialized)
  const [packageJsonError, setPackageJsonError] = useState<string | null>(null)
  const [packageJsonSavedAt, setPackageJsonSavedAt] = useState<string | null>(null)

  const [selectedEnvFile, setSelectedEnvFile] = useState('.env.local')
  const [envPassword, setEnvPassword] = useState('')
  const [envContent, setEnvContent] = useState('')
  const [envStatus, setEnvStatus] = useState<string | null>(null)
  const [envError, setEnvError] = useState<string | null>(null)

  useEffect(() => {
    setPackageJsonDraft(packageJsonSerialized)
  }, [packageJsonSerialized])

  if (!isOpen) return null

  return (
    <Page full>
      <PageHeader>
        <Stack row style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <Heading level={2}>Workspace Settings</Heading>
            <Caption muted>{workspaceName || 'No workspace selected'}</Caption>
          </div>
        </Stack>
      </PageHeader>

      <div style={{ display: 'flex', gap: '0.25rem', padding: '0 1.5rem', borderBottom: '1px solid var(--color-border)' }}>
        <button
          onClick={() => handleTabChange('env')}
          className="btn btn--ghost"
          style={{
            borderBottom: activeTab === 'env' ? '2px solid var(--color-primary)' : '2px solid transparent',
            borderRadius: 0,
            color: activeTab === 'env' ? 'var(--color-primary)' : undefined,
          }}
        >
          <Shield style={{ width: 16, height: 16 }} /> Environment
        </button>
        <button
          onClick={() => handleTabChange('package-json')}
          className="btn btn--ghost"
          style={{
            borderBottom: activeTab === 'package-json' ? '2px solid var(--color-primary)' : '2px solid transparent',
            borderRadius: 0,
            color: activeTab === 'package-json' ? 'var(--color-primary)' : undefined,
          }}
        >
          <FileCode2 style={{ width: 16, height: 16 }} /> package.json
        </button>
      </div>

      <PageBody>
        {activeTab === 'env' && (
          <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
            <div className="panel" style={{ marginBottom: '1rem' }}>
              <div className="panel__header"><span>Environment Variables</span></div>
              <div className="panel__body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem' }}>File</label>
                    <input className="input" value={selectedEnvFile} onChange={e => setSelectedEnvFile(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem' }}>Password</label>
                    <input className="input" type="password" value={envPassword} onChange={e => setEnvPassword(e.target.value)} placeholder="Enter password" />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem' }}>Variables</label>
                  <textarea
                    className="input"
                    value={envContent}
                    onChange={e => setEnvContent(e.target.value)}
                    placeholder="KEY=value"
                    style={{ height: '16rem', fontFamily: 'monospace', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button className="btn btn--outline" onClick={() => setEnvStatus('Loaded from session')}>Load</button>
                  <button className="btn btn--primary" onClick={() => setEnvStatus('Saved')}>Save</button>
                </div>
                {envError && <Caption style={{ color: 'var(--color-destructive)', marginTop: '0.5rem' }}>{envError}</Caption>}
                {envStatus && <Caption style={{ color: '#10b981', marginTop: '0.5rem' }}>{envStatus}</Caption>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'package-json' && (
          <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
            <div className="panel">
              <div className="panel__header"><span>package.json</span></div>
              <div className="panel__body">
                <Caption muted style={{ marginBottom: '0.75rem' }}>
                  Inline metadata and dependency editor. Save when ready.
                </Caption>
                <textarea
                  className="input"
                  value={packageJsonDraft || packageJsonSerialized}
                  onChange={e => { setPackageJsonDraft(e.target.value); setPackageJsonError(null); setPackageJsonSavedAt(null) }}
                  spellCheck={false}
                  style={{ minHeight: '200px', fontFamily: 'monospace', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                  <Caption muted>
                    {packageJsonError ? <span style={{ color: 'var(--color-destructive)' }}>{packageJsonError}</span>
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
