/**
 * Pod Spaces Browser — /$username/$studioId/pod/
 *
 * Lists pod projects and their spaces, lets the user pick one, then navigates
 * to the existing space views (raw, agent builder, etc.) under the `pod`
 * storageId so all existing routes render unchanged.
 *
 * Hydration: loads pod space files into AppFS at
 *   {username}/{studioId}/pod/{podSpaceId}/
 * which is exactly what SpaceProvider / SpaceFS expect for storageId=pod.
 */
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@lmthing/auth'
import { useApp } from '@lmthing/state'
import {
  listProjects,
  listPodSpaces,
  loadPodSpace,
  type PodProject,
  type PodSpaceMeta,
} from '@/lib/pod/podSpaces'

// ── Loading state ─────────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading-projects' | 'loading-spaces' | 'loading-files' | 'error'

function PodSpacesBrowser() {
  const { username, studioId } = Route.useParams()
  const { session } = useAuth()
  const { appFS, importStudio } = useApp()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)

  const [projects, setProjects] = useState<PodProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('user')
  const [spaces, setSpaces] = useState<PodSpaceMeta[]>([])

  // Load projects on mount
  useEffect(() => {
    if (!session?.accessToken) return
    setPhase('loading-projects')
    listProjects(session.accessToken)
      .then((ps) => {
        setProjects(ps)
        // Keep selectedProjectId as 'user' unless projects don't include it
        if (ps.length > 0 && !ps.find((p) => p.id === 'user')) {
          setSelectedProjectId(ps[0].id)
        }
        setPhase('idle')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
        setPhase('error')
      })
  }, [session?.accessToken])

  // Load spaces when project changes
  useEffect(() => {
    if (!session?.accessToken || !selectedProjectId) return
    setPhase('loading-spaces')
    setSpaces([])
    listPodSpaces(selectedProjectId, session.accessToken)
      .then((ss) => {
        setSpaces(ss)
        setPhase('idle')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
        setPhase('error')
      })
  }, [session?.accessToken, selectedProjectId])

  /**
   * Open a pod space:
   * 1. Fetch all files from the pod.
   * 2. Hydrate AppFS under {username}/{studioId}/pod/{podSpaceId}/.
   * 3. Register the space in lmthing.json so StudioContext sees it.
   * 4. Navigate to the existing raw view (storageId=pod, spaceId=podSpaceId).
   */
  const openSpace = useCallback(
    async (meta: PodSpaceMeta) => {
      if (!session?.accessToken) return
      try {
        setPhase('loading-files')

        const fileMap = await loadPodSpace(selectedProjectId, meta.id, session.accessToken)

        // Build the file tree for importStudio:
        // importStudio writes files under {username}/{studioId}/{relativePath}
        // so relativePath = "pod/{meta.id}/{file}" for each file.
        const spacePrefix = `pod/${meta.id}`

        // Register space in lmthing.json
        const configPath = `${username}/${studioId}/lmthing.json`
        let config: Record<string, unknown> = {
          id: studioId,
          name: studioId,
          version: '1.0.0',
          spaces: {},
          settings: {},
        }
        const existing = appFS.readFile(configPath)
        if (existing) {
          try {
            config = JSON.parse(existing) as Record<string, unknown>
          } catch {
            // ignore parse errors
          }
        }
        const spacesCfg = (config.spaces as Record<string, unknown>) ?? {}
        spacesCfg[`pod/${meta.id}`] = {
          name: meta.name,
          description: meta.description ?? '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: 'pod',
          podProjectId: selectedProjectId,
          podSpaceId: meta.id,
        }
        config.spaces = spacesCfg

        // Import files into AppFS
        const filesForImport: Record<string, string> = {
          'lmthing.json': JSON.stringify(config, null, 2),
        }
        for (const [relPath, content] of Object.entries(fileMap)) {
          filesForImport[`${spacePrefix}/${relPath}`] = content
        }
        importStudio(username, studioId, filesForImport)

        setPhase('idle')

        // Navigate to raw view: /$username/$studioId/pod/$spaceId/raw
        await navigate({
          to: '/$username/$studioId/$storageId/$spaceId/raw',
          params: {
            username,
            studioId,
            storageId: 'pod',
            spaceId: meta.id,
          },
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setPhase('error')
      }
    },
    [session, selectedProjectId, username, studioId, appFS, importStudio, navigate],
  )

  if (!session) {
    return <div style={styles.center}>Signing in…</div>
  }

  if (phase === 'error' && error) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#c00' }}>Failed to load pod spaces: {error}</p>
        <button onClick={() => { setError(null); setPhase('idle') }}>Dismiss</button>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Pod Spaces</h2>
        <p style={styles.subtitle}>Browse and edit spaces generated by your agent pod.</p>
      </div>

      {/* Project selector */}
      {projects.length > 1 && (
        <div style={styles.row}>
          <label style={styles.label} htmlFor="pod-project-select">Project</label>
          <select
            id="pod-project-select"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={styles.select}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name ?? p.id}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Loading indicator */}
      {(phase === 'loading-projects' || phase === 'loading-spaces' || phase === 'loading-files') && (
        <div style={styles.loading}>
          {phase === 'loading-projects' && 'Loading projects…'}
          {phase === 'loading-spaces' && 'Loading spaces…'}
          {phase === 'loading-files' && 'Loading space files…'}
        </div>
      )}

      {/* Space list */}
      {phase === 'idle' && spaces.length === 0 && (
        <div style={styles.empty}>No spaces found in project &ldquo;{selectedProjectId}&rdquo;.</div>
      )}

      {spaces.length > 0 && (
        <ul style={styles.list}>
          {spaces.map((space) => (
            <li key={space.id} style={styles.item}>
              <button
                onClick={() => void openSpace(space)}
                disabled={phase === 'loading-files'}
                style={styles.spaceButton}
              >
                <span style={styles.spaceName}>{space.name}</span>
                {space.description && (
                  <span style={styles.spaceDesc}>{space.description}</span>
                )}
                {space.agents && space.agents.length > 0 && (
                  <span style={styles.spaceMeta}>
                    {space.agents.length} agent{space.agents.length !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={styles.backRow}>
        <Link
          to="/$username/$studioId"
          params={{ username, studioId }}
          style={styles.backLink}
        >
          ← Back to studio
        </Link>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '2rem',
    maxWidth: 640,
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#6b7280',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: '0 0 0.25rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    opacity: 0.6,
    margin: 0,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.25rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 500,
    flexShrink: 0,
  },
  select: {
    padding: '0.25rem 0.5rem',
    borderRadius: 4,
    border: '1px solid var(--color-border, #333)',
    background: 'var(--color-surface, #1a1a1a)',
    color: 'inherit',
    fontSize: '0.875rem',
  },
  loading: {
    fontSize: '0.875rem',
    opacity: 0.6,
    marginBottom: '1rem',
  },
  empty: {
    fontSize: '0.875rem',
    opacity: 0.5,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  item: {
    margin: 0,
  },
  spaceButton: {
    width: '100%',
    textAlign: 'left',
    padding: '0.75rem 1rem',
    borderRadius: 6,
    border: '1px solid var(--color-border, #333)',
    background: 'var(--color-surface, #1a1a1a)',
    color: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  spaceName: {
    fontWeight: 500,
    fontSize: '0.9375rem',
  },
  spaceDesc: {
    fontSize: '0.8125rem',
    opacity: 0.6,
  },
  spaceMeta: {
    fontSize: '0.75rem',
    opacity: 0.45,
  },
  backRow: {
    marginTop: '2rem',
  },
  backLink: {
    fontSize: '0.875rem',
    opacity: 0.6,
    color: 'inherit',
    textDecoration: 'none',
  },
}

export const Route = createFileRoute('/$username/$studioId/pod/')({
  component: PodSpacesBrowser,
})
