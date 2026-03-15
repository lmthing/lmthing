import { useEffect, useRef, useState, useCallback } from 'react'
import type { AuthSession } from './types'

export interface RepoSyncState {
  isSyncing: boolean
  lastSynced: Date | null
  error: string | null
  fileCount: number
}

export interface RepoSyncOptions {
  session: AuthSession | null
  isAuthenticated: boolean
  /** The GitHub access token (from GithubContext device flow or Supabase provider token) */
  githubToken: string | null
  /** Callback invoked with the flat file map from the repo */
  onFilesLoaded: (files: Record<string, string>) => void
}

/**
 * Hook that fetches the latest files from the user's GitHub repo on login.
 * Only runs once per session (uses a ref to track).
 */
export function useRepoSync({ session, isAuthenticated, githubToken, onFilesLoaded }: RepoSyncOptions): RepoSyncState {
  const [state, setState] = useState<RepoSyncState>({
    isSyncing: false,
    lastSynced: null,
    error: null,
    fileCount: 0,
  })
  const syncedRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || !session?.githubRepo || !githubToken || syncedRef.current) return

    syncedRef.current = true

    async function fetchRepo() {
      setState(prev => ({ ...prev, isSyncing: true, error: null }))

      try {
        const [owner, repo] = session!.githubRepo!.split('/')
        if (!owner || !repo) {
          throw new Error(`Invalid repo format: ${session!.githubRepo}`)
        }

        // Use GitHub API to fetch the repo tree
        const headers = {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        }

        // Get default branch
        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers })
        if (repoRes.status === 404) {
          // Repo doesn't exist yet — this is expected for new users
          setState(prev => ({ ...prev, isSyncing: false, fileCount: 0 }))
          return
        }
        if (!repoRes.ok) throw new Error(`GitHub API error: ${repoRes.status}`)
        const repoData = await repoRes.json()
        const defaultBranch = repoData.default_branch || 'main'

        // Get branch tree
        const branchRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/branches/${defaultBranch}`,
          { headers }
        )
        if (!branchRes.ok) throw new Error(`Failed to fetch branch: ${branchRes.status}`)
        const branchData = await branchRes.json()

        // Get recursive tree
        const treeRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/${branchData.commit.commit.tree.sha}?recursive=1`,
          { headers }
        )
        if (!treeRes.ok) throw new Error(`Failed to fetch tree: ${treeRes.status}`)
        const treeData = await treeRes.json()

        // Filter relevant files
        const entries = treeData.tree.filter(
          (entry: { type: string; path: string }) =>
            entry.type === 'blob' &&
            (entry.path === 'package.json' ||
              entry.path === 'lmthing.json' ||
              /^\.env(?:\.[A-Za-z0-9_-]+)*$/.test(entry.path) ||
              entry.path.startsWith('agents/') ||
              entry.path.startsWith('flows/') ||
              entry.path.startsWith('knowledge/'))
        )

        // Fetch file contents
        const files: Record<string, string> = {}
        for (const entry of entries) {
          const blobRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/blobs/${entry.sha}`,
            { headers }
          )
          if (!blobRes.ok) continue
          const blobData = await blobRes.json()
          const content = decodeBase64Utf8(blobData.content)
          files[entry.path] = content
        }

        onFilesLoaded(files)
        setState({
          isSyncing: false,
          lastSynced: new Date(),
          error: null,
          fileCount: Object.keys(files).length,
        })
      } catch (err) {
        setState(prev => ({
          ...prev,
          isSyncing: false,
          error: err instanceof Error ? err.message : 'Failed to sync repo',
        }))
      }
    }

    void fetchRepo()
  }, [isAuthenticated, session, githubToken, onFilesLoaded])

  return state
}

function decodeBase64Utf8(base64: string): string {
  const normalized = base64.replace(/\n/g, '')
  const binary = atob(normalized)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
