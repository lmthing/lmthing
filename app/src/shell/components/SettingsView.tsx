import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Shield, FileCode2, Search, PackagePlus, Trash2, Info, RotateCcw } from 'lucide-react'
import { useWorkspaceData } from '@/lib/workspaceDataContext'
import type { PackageJson } from '@/types/workspace-data'
import { toWorkspaceRouteParam } from '@/lib/workspaces'
import {
  applyEnvToWindowProcessEnv,
  decryptEnvContent,
  encryptEnvContent,
  isValidEnvFileName,
  normalizeEnvFileName,
  parseDotEnv,
} from '@/lib/envCrypto'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SettingsViewProps {
  isOpen: boolean
}

interface DependencyRow {
  name: string
  version: string
  section: 'dependencies' | 'devDependencies'
}

interface NpmSearchResponse {
  objects?: Array<{
    package?: {
      name?: string
      version?: string
      description?: string
    }
  }>
}

interface NpmSearchItem {
  name: string
  version: string
  description: string
}

const ENV_SESSION_CACHE_PREFIX = 'lmthing-session-env'

function getEnvSessionCacheKey(workspaceId: string, fileName: string): string {
  return `${ENV_SESSION_CACHE_PREFIX}:${workspaceId}:${fileName}`
}

function readSessionEnvPlaintext(workspaceId: string, fileName: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(getEnvSessionCacheKey(workspaceId, fileName))
  } catch {
    return null
  }
}

function writeSessionEnvPlaintext(workspaceId: string, fileName: string, plaintext: string) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(getEnvSessionCacheKey(workspaceId, fileName), plaintext)
  } catch {
    // Ignore storage errors
  }
}

function removeSessionEnvPlaintext(workspaceId: string, fileName: string) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(getEnvSessionCacheKey(workspaceId, fileName))
  } catch {
    // Ignore storage errors
  }
}

export function SettingsView({ isOpen }: SettingsViewProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { workspaceName } = useParams()
  
  const {
    workspaceData,
    packageJson,
    env,
    updatePackageJson,
    upsertEnvFile,
    deleteEnvFile,
    clearAllData,
  } = useWorkspaceData()

  // Determine active tab from URL - default to env
  const activeTab = useMemo(() => {
    if (location.pathname.includes('/settings/package-json')) return 'package-json'
    return 'env' // default to env tab
  }, [location.pathname])

  const handleTabChange = (tab: 'env' | 'package-json') => {
    if (!workspaceName) return
    const basePath = `/studio/${toWorkspaceRouteParam(workspaceName)}/settings`
    navigate(`${basePath}/${tab}`)
  }

  const envFileNames = useMemo(() => Object.keys(env).sort(), [env])
  const packageJsonSerialized = useMemo(
    () => (packageJson ? JSON.stringify(packageJson, null, 2) : ''),
    [packageJson]
  )

  const [packageJsonDraft, setPackageJsonDraft] = useState(packageJsonSerialized)
  const [packageJsonError, setPackageJsonError] = useState<string | null>(null)
  const [packageJsonSavedAt, setPackageJsonSavedAt] = useState<string | null>(null)
  const [npmSearchQuery, setNpmSearchQuery] = useState('')
  const [isNpmSearching, setIsNpmSearching] = useState(false)
  const [npmSearchResults, setNpmSearchResults] = useState<NpmSearchItem[]>([])
  const [npmSearchError, setNpmSearchError] = useState<string | null>(null)
  const [installTargetSection, setInstallTargetSection] = useState<'dependencies' | 'devDependencies'>('dependencies')
  const [manualDependencyName, setManualDependencyName] = useState('')
  const [manualDependencyVersion, setManualDependencyVersion] = useState('')

  const [selectedEnvFile, setSelectedEnvFile] = useState('.env.local')
  const [newEnvFileName, setNewEnvFileName] = useState('.env.local')
  const [envPassword, setEnvPassword] = useState('')
  const [envContent, setEnvContent] = useState('')
  const [envStatus, setEnvStatus] = useState<string | null>(null)
  const [envError, setEnvError] = useState<string | null>(null)
  const [isEnvLoaded, setIsEnvLoaded] = useState(false)
  const [expiresInDays, setExpiresInDays] = useState('30')
  const [isEnvExampleDialogOpen, setIsEnvExampleDialogOpen] = useState(false)

  const effectiveSelectedEnvFile =
    selectedEnvFile || (envFileNames.length > 0 ? envFileNames[0] : '.env.local')
  const workspaceId = workspaceData?.id || 'workspace'
  const cachedSessionEnvContent = useMemo(
    () => (isOpen ? readSessionEnvPlaintext(workspaceId, effectiveSelectedEnvFile) : null),
    [isOpen, workspaceId, effectiveSelectedEnvFile]
  )

  const selectedEncryptedEnv = env[effectiveSelectedEnvFile]
  const displayedPackageJsonDraft = packageJsonDraft || packageJsonSerialized
  const displayedEnvContent = envContent || cachedSessionEnvContent || ''
  const derivedSessionStatus =
    !envStatus && cachedSessionEnvContent !== null
      ? `Loaded from session`
      : null

  useEffect(() => {
    setPackageJsonDraft(packageJsonSerialized)
  }, [packageJsonSerialized])

  useEffect(() => {
    if (!isOpen || cachedSessionEnvContent === null) return
    applyEnvToWindowProcessEnv(parseDotEnv(cachedSessionEnvContent))
  }, [isOpen, cachedSessionEnvContent])

  const parsedPackageJsonDraft = useMemo(() => {
    try {
      return JSON.parse(displayedPackageJsonDraft || '{}') as PackageJson
    } catch {
      return null
    }
  }, [displayedPackageJsonDraft])

  const dependencyRows = useMemo<DependencyRow[]>(() => {
    if (!parsedPackageJsonDraft) return []

    const regular = Object.entries(parsedPackageJsonDraft.dependencies || {}).map(([name, version]) => ({
      name,
      version,
      section: 'dependencies' as const,
    }))
    const dev = Object.entries(parsedPackageJsonDraft.devDependencies || {}).map(([name, version]) => ({
      name,
      version,
      section: 'devDependencies' as const,
    }))

    return [...regular, ...dev].sort((a, b) => a.name.localeCompare(b.name))
  }, [parsedPackageJsonDraft])

  const applyPackageDraftUpdate = (updater: (current: PackageJson) => PackageJson) => {
    const current = parsedPackageJsonDraft || packageJson || { name: 'workspace-package', version: '0.1.0' }
    const next = updater({
      ...current,
      dependencies: { ...(current.dependencies || {}) },
      devDependencies: { ...(current.devDependencies || {}) },
    })

    setPackageJsonDraft(JSON.stringify(next, null, 2))
    setPackageJsonError(null)
    setPackageJsonSavedAt(null)
  }

  const upsertDependency = (
    name: string,
    version: string,
    section: 'dependencies' | 'devDependencies'
  ) => {
    const normalizedName = name.trim()
    if (!normalizedName) return

    const normalizedVersion = version.trim() || 'latest'

    applyPackageDraftUpdate((current) => {
      const nextDependencies = { ...(current.dependencies || {}) }
      const nextDevDependencies = { ...(current.devDependencies || {}) }

      if (section === 'dependencies') {
        delete nextDevDependencies[normalizedName]
        nextDependencies[normalizedName] = normalizedVersion
      } else {
        delete nextDependencies[normalizedName]
        nextDevDependencies[normalizedName] = normalizedVersion
      }

      return {
        ...current,
        dependencies: nextDependencies,
        devDependencies: nextDevDependencies,
      }
    })
  }

  const removeDependency = (name: string, section: 'dependencies' | 'devDependencies') => {
    applyPackageDraftUpdate((current) => {
      if (section === 'dependencies') {
        const nextDependencies = { ...(current.dependencies || {}) }
        delete nextDependencies[name]
        return {
          ...current,
          dependencies: nextDependencies,
        }
      }

      const nextDevDependencies = { ...(current.devDependencies || {}) }
      delete nextDevDependencies[name]
      return {
        ...current,
        devDependencies: nextDevDependencies,
      }
    })
  }

  const handleNpmSearch = async () => {
    const query = npmSearchQuery.trim()
    if (!query) {
      setNpmSearchResults([])
      setNpmSearchError('Type a package name to search npm.')
      return
    }

    setNpmSearchError(null)
    setIsNpmSearching(true)

    try {
      const response = await fetch(`https://registry.npmjs.org/-/v1/search?size=10&text=${encodeURIComponent(query)}`)
      if (!response.ok) {
        throw new Error(`npm search failed with status ${response.status}`)
      }

      const data = (await response.json()) as NpmSearchResponse
      const results = (data.objects || [])
        .map((entry) => {
          const pkg = entry.package
          if (!pkg?.name || !pkg.version) return null

          return {
            name: pkg.name,
            version: pkg.version,
            description: pkg.description || 'No description.',
          }
        })
        .filter((item): item is NpmSearchItem => item !== null)

      setNpmSearchResults(results)
      if (results.length === 0) {
        setNpmSearchError('No npm packages matched this query.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'npm search failed.'
      setNpmSearchError(message)
      setNpmSearchResults([])
    } finally {
      setIsNpmSearching(false)
    }
  }

  const handleSavePackageJson = () => {
    try {
      const parsed = JSON.parse(packageJsonDraft || packageJsonSerialized) as Record<string, unknown>

      if (typeof parsed.name !== 'string' || typeof parsed.version !== 'string') {
        setPackageJsonError('`name` and `version` are required string fields.')
        return
      }

      updatePackageJson(parsed as PackageJson)
      setPackageJsonError(null)
      setPackageJsonSavedAt(new Date().toLocaleTimeString())
    } catch {
      setPackageJsonError('Invalid JSON format in package.json editor.')
    }
  }

  const handleAddManualDependency = () => {
    const name = manualDependencyName.trim()
    if (!name) {
      setPackageJsonError('Dependency name is required.')
      return
    }

    upsertDependency(name, manualDependencyVersion, installTargetSection)
    setManualDependencyName('')
    setManualDependencyVersion('')
  }

  const handleUseEnvFileName = () => {
    const normalized = normalizeEnvFileName(newEnvFileName)
    if (!isValidEnvFileName(normalized)) {
      setEnvError('Invalid env filename. Use .env, .env.local, .env.production, etc.')
      return
    }

    setSelectedEnvFile(normalized)
    setNewEnvFileName(normalized)
    setEnvContent('')
    setEnvStatus(null)
    setEnvError(null)
    setIsEnvLoaded(false)

    const cachedPlaintext = readSessionEnvPlaintext(workspaceId, normalized)
    if (cachedPlaintext !== null) {
      setEnvContent(cachedPlaintext)
      setIsEnvLoaded(true)
      setEnvStatus(`Loaded ${normalized} from session memory (unencrypted).`)
      applyEnvToWindowProcessEnv(parseDotEnv(cachedPlaintext))
    }
  }

  const handleLoadEnvFile = async () => {
    setEnvError(null)
    setEnvStatus(null)

    const cachedPlaintext = readSessionEnvPlaintext(workspaceId, effectiveSelectedEnvFile)
    if (cachedPlaintext !== null) {
      setEnvContent(cachedPlaintext)
      setIsEnvLoaded(true)
      const envMap = parseDotEnv(cachedPlaintext)
      applyEnvToWindowProcessEnv(envMap)
      setEnvStatus(
        `Loaded ${effectiveSelectedEnvFile} from session memory (${Object.keys(envMap).length} vars).`
      )
      return
    }

    if (!selectedEncryptedEnv) {
      setEnvContent('')
      setIsEnvLoaded(true)
      setEnvStatus(`Created new ${effectiveSelectedEnvFile} draft.`)
      return
    }

    try {
      const plaintext = await decryptEnvContent(selectedEncryptedEnv, envPassword)
      setEnvContent(plaintext)
      setIsEnvLoaded(true)
      writeSessionEnvPlaintext(workspaceId, effectiveSelectedEnvFile, plaintext)

      const envMap = parseDotEnv(plaintext)
      applyEnvToWindowProcessEnv(envMap)

      setEnvStatus(
        `Loaded ${effectiveSelectedEnvFile} (${Object.keys(envMap).length} vars) into window.process.env.`
      )
    } catch {
      setEnvError('Could not decrypt file. Check the password for this env file.')
      setIsEnvLoaded(false)
    }
  }

  const handleSaveEnvFile = async () => {
    setEnvError(null)
    setEnvStatus(null)

    if (!envPassword.trim()) {
      setEnvError('Password is required to encrypt and save env files.')
      return
    }

    if (!isValidEnvFileName(effectiveSelectedEnvFile)) {
      setEnvError('Invalid env filename. Use .env, .env.local, .env.production, etc.')
      return
    }

    try {
      const expiresDaysNumber = Number.parseInt(expiresInDays, 10)
      const encrypted = await encryptEnvContent({
        plaintext: displayedEnvContent,
        password: envPassword,
        previous: selectedEncryptedEnv,
        expiresInDays: Number.isNaN(expiresDaysNumber) ? 30 : Math.max(expiresDaysNumber, 1),
      })

      upsertEnvFile(effectiveSelectedEnvFile, encrypted)
      writeSessionEnvPlaintext(workspaceId, effectiveSelectedEnvFile, displayedEnvContent)

      const envMap = parseDotEnv(displayedEnvContent)
      applyEnvToWindowProcessEnv(envMap)

      setIsEnvLoaded(true)
      setEnvStatus(
        `Saved ${effectiveSelectedEnvFile} encrypted and loaded ${Object.keys(envMap).length} vars into window.process.env.`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to encrypt env file.'
      setEnvError(message)
    }
  }

  const handleDeleteSelectedEnv = () => {
    if (!env[effectiveSelectedEnvFile]) return

    const confirmed = window.confirm(`Delete ${effectiveSelectedEnvFile} from workspace env data?`)
    if (!confirmed) return

    deleteEnvFile(effectiveSelectedEnvFile)
    removeSessionEnvPlaintext(workspaceId, effectiveSelectedEnvFile)
    setEnvContent('')
    setIsEnvLoaded(false)
    setEnvStatus(`${effectiveSelectedEnvFile} deleted.`)
    setEnvError(null)
  }

  if (!isOpen) return null

  return (
    <div className="h-full w-full flex items-start justify-center bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Workspace Settings</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {workspaceData ? `Workspace: ${workspaceData.id}` : 'No workspace selected'}
              </p>
            </div>
            <button
              onClick={() => {
                const confirmed = window.confirm(
                  'This will clear ALL storage and session data and refresh the page. Continue?'
                )
                if (confirmed) {
                  clearAllData()
                }
              }}
              className="flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/30"
              title="Clear all storage and session data, then refresh"
            >
              <RotateCcw className="h-4 w-4" />
              Reset & Refresh
            </button>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-1 px-5">
            <button
              onClick={() => handleTabChange('env')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'env'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Shield className="inline-block h-4 w-4 mr-1.5" />
              Environment
            </button>
            <button
              onClick={() => handleTabChange('package-json')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'package-json'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <FileCode2 className="inline-block h-4 w-4 mr-1.5" />
              package.json
            </button>
          </div>
        </div>

        {activeTab === 'package-json' && (
        <div className="flex-1 overflow-y-auto">
          <section className="flex min-h-0 flex-col p-5">
            <div className="mb-3 flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-violet-500" />
              <h3 className="font-medium text-slate-900 dark:text-slate-100">package.json</h3>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inline metadata and dependency studio with npm search. Save when ready.
              </p>

              <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 shadow-sm dark:border-violet-900/40 dark:from-violet-950/20 dark:via-slate-900 dark:to-fuchsia-950/20">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Name
                    <input
                      value={parsedPackageJsonDraft?.name || ''}
                      onChange={(event) => {
                        const value = event.target.value
                        applyPackageDraftUpdate((current) => ({ ...current, name: value }))
                      }}
                      placeholder="my-workspace"
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Version
                    <input
                      value={parsedPackageJsonDraft?.version || ''}
                      onChange={(event) => {
                        const value = event.target.value
                        applyPackageDraftUpdate((current) => ({ ...current, version: value }))
                      }}
                      placeholder="0.1.0"
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>

                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 sm:col-span-2">
                    Description
                    <input
                      value={parsedPackageJsonDraft?.description || ''}
                      onChange={(event) => {
                        const value = event.target.value
                        applyPackageDraftUpdate((current) => ({ ...current, description: value }))
                      }}
                      placeholder="Describe this workspace package"
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Dependencies</h4>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {dependencyRows.length} packages
                  </span>
                </div>

                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      value={npmSearchQuery}
                      onChange={(event) => setNpmSearchQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void handleNpmSearch()
                        }
                      }}
                      placeholder="Search npm packages (react, zod, axios...)"
                      className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <button
                    onClick={() => {
                      void handleNpmSearch()
                    }}
                    className="rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700"
                  >
                    {isNpmSearching ? 'Searching...' : 'Search npm'}
                  </button>
                </div>

                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_150px_auto]">
                  <input
                    value={manualDependencyName}
                    onChange={(event) => setManualDependencyName(event.target.value)}
                    placeholder="package name"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <input
                    value={manualDependencyVersion}
                    onChange={(event) => setManualDependencyVersion(event.target.value)}
                    placeholder="version (default: latest)"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <select
                    value={installTargetSection}
                    onChange={(event) => setInstallTargetSection(event.target.value as 'dependencies' | 'devDependencies')}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="dependencies">dependencies</option>
                    <option value="devDependencies">devDependencies</option>
                  </select>
                  <button
                    onClick={handleAddManualDependency}
                    className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <PackagePlus className="h-4 w-4" /> Add
                  </button>
                </div>

                {npmSearchError ? (
                  <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">{npmSearchError}</p>
                ) : null}

                {npmSearchResults.length > 0 ? (
                  <div className="mb-3 max-h-52 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900/40">
                    {npmSearchResults.map((result) => (
                      <div
                        key={result.name}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{result.name}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{result.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {result.version}
                          </span>
                          <button
                            onClick={() => upsertDependency(result.name, `^${result.version}`, installTargetSection)}
                            className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            Install
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {dependencyRows.length > 0 ? (
                    dependencyRows.map((dep) => (
                      <div
                        key={`${dep.section}-${dep.name}`}
                        className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60 sm:grid-cols-[1fr_130px_120px_auto]"
                      >
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{dep.name}</p>

                        <input
                          value={dep.version}
                          onChange={(event) => upsertDependency(dep.name, event.target.value, dep.section)}
                          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />

                        <select
                          value={dep.section}
                          onChange={(event) => upsertDependency(dep.name, dep.version, event.target.value as 'dependencies' | 'devDependencies')}
                          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <option value="dependencies">dependencies</option>
                          <option value="devDependencies">devDependencies</option>
                        </select>

                        <button
                          onClick={() => removeDependency(dep.name, dep.section)}
                          className="inline-flex items-center justify-center gap-1 rounded-md border border-red-200 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      No dependencies yet. Search npm or add one manually.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Raw JSON editor
                </p>
                <textarea
                  value={displayedPackageJsonDraft}
                  onChange={(event) => setPackageJsonDraft(event.target.value)}
                  spellCheck={false}
                  className="min-h-[200px] w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-800 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {packageJsonError ? (
                  <span className="text-red-500">{packageJsonError}</span>
                ) : packageJsonSavedAt ? (
                  <span>Saved at {packageJsonSavedAt}</span>
                ) : (
                  <span>Ready to save</span>
                )}
              </div>
              <button
                onClick={handleSavePackageJson}
                className="rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700"
              >
                Save package.json
              </button>
            </div>
          </section>
        </div>
        )}

        {activeTab === 'env' && (
        <div className="flex-1 overflow-y-auto">
          <section className="flex min-h-0 flex-col p-5 space-y-4">
            {/* Header with info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  <h3 className="font-medium text-slate-900 dark:text-slate-100">Environment Variables</h3>
                </div>
                <button
                  onClick={() => setIsEnvExampleDialogOpen(true)}
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400 flex items-center gap-1"
                >
                  <Info className="h-3 w-3" />
                  View examples
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Environment files are encrypted and stored securely. Enter a password to decrypt/save.
              </p>
            </div>

            {/* File selection and password */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                      File
                    </label>
                    <select
                      value={effectiveSelectedEnvFile}
                      onChange={(event) => {
                        const nextFileName = event.target.value
                        setSelectedEnvFile(nextFileName)
                        setEnvStatus(null)
                        setEnvError(null)
                        setIsEnvLoaded(false)

                        const cachedPlaintext = readSessionEnvPlaintext(workspaceId, nextFileName)
                        if (cachedPlaintext !== null) {
                          setEnvContent(cachedPlaintext)
                          setIsEnvLoaded(true)
                          applyEnvToWindowProcessEnv(parseDotEnv(cachedPlaintext))
                        } else {
                          setEnvContent('')
                        }
                      }}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value={effectiveSelectedEnvFile}>{effectiveSelectedEnvFile}</option>
                      {envFileNames
                        .filter((name) => name !== effectiveSelectedEnvFile)
                        .map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                      Password
                    </label>
                    <input
                      type="password"
                      value={envPassword}
                      onChange={(event) => setEnvPassword(event.target.value)}
                      placeholder="Enter password"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Create new file */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                    Create new file
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={newEnvFileName}
                      onChange={(event) => setNewEnvFileName(event.target.value)}
                      placeholder=".env.local"
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      onClick={handleUseEnvFileName}
                      className="rounded-md bg-slate-600 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Environment editor */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                Variables
              </label>
              <textarea
                value={displayedEnvContent}
                onChange={(event) => {
                  setEnvContent(event.target.value)
                  setIsEnvLoaded(true)
                }}
                spellCheck={false}
                placeholder="KEY=value&#10;ANOTHER_KEY=another_value"
                className="w-full h-64 rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    void handleLoadEnvFile()
                  }}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Load
                </button>
                <button
                  onClick={() => {
                    void handleSaveEnvFile()
                  }}
                  className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Save
                </button>
                <button
                  onClick={handleDeleteSelectedEnv}
                  disabled={!env[effectiveSelectedEnvFile]}
                  className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  Delete
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Expires in
                </label>
                <input
                  type="number"
                  min={1}
                  value={expiresInDays}
                  onChange={(event) => setExpiresInDays(event.target.value)}
                  className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">days</span>
              </div>
            </div>

            {/* Status message */}
            {(envError || envStatus || derivedSessionStatus || isEnvLoaded) && (
              <div className="text-xs">
                {envError ? (
                  <span className="text-red-500">{envError}</span>
                ) : envStatus ? (
                  <span className="text-emerald-600 dark:text-emerald-400">{envStatus}</span>
                ) : derivedSessionStatus ? (
                  <span className="text-emerald-600 dark:text-emerald-400">{derivedSessionStatus}</span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">Ready to edit</span>
                )}
              </div>
            )}
          </section>
        </div>
        )}
      </div>

      {/* .env.example Dialog */}
      <Dialog open={isEnvExampleDialogOpen} onOpenChange={setIsEnvExampleDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Configuration Examples</DialogTitle>
            <DialogDescription>
              Example environment variables for various providers and configurations
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            <pre className="text-xs bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-x-auto">
              <code>{`# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Anthropic Configuration
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# Google AI Configuration (Generative AI)
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key-here

# Google Vertex AI Configuration
GOOGLE_VERTEX_PROJECT=your-gcp-project-id
GOOGLE_VERTEX_LOCATION=us-central1

# Mistral Configuration
MISTRAL_API_KEY=your-mistral-api-key-here

# Azure OpenAI Configuration
AZURE_API_KEY=your-azure-api-key-here
AZURE_RESOURCE_NAME=your-azure-resource-name

# Groq Configuration
GROQ_API_KEY=your-groq-api-key-here

# Cohere Configuration
COHERE_API_KEY=your-cohere-api-key-here

# Amazon Bedrock Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
# AWS_SESSION_TOKEN=your-aws-session-token  # Optional, for temporary credentials

# Custom OpenAI-Compatible Providers
# Format: {NAME}_API_KEY, {NAME}_API_BASE, {NAME}_API_TYPE=openai
# These will be automatically detected and registered

# Example: Z.AI
ZAI_API_KEY=your-zai-api-key-here
ZAI_API_BASE=https://api.z.ai/api/coding/paas/v4
ZAI_API_TYPE=openai
ZAI_API_NAME=zai  # Optional display name

# Example: OpenRouter
OPENROUTER_API_KEY=your-openrouter-api-key-here
OPENROUTER_API_BASE=https://openrouter.ai/api/v1
OPENROUTER_API_TYPE=openai
OPENROUTER_API_NAME=openrouter  # Optional display name

# Example: Together AI
TOGETHER_API_KEY=your-together-api-key-here
TOGETHER_API_BASE=https://api.together.xyz/v1
TOGETHER_API_TYPE=openai
TOGETHER_API_NAME=together  # Optional display name

# Example: Perplexity
PERPLEXITY_API_KEY=your-perplexity-api-key-here
PERPLEXITY_API_BASE=https://api.perplexity.ai
PERPLEXITY_API_TYPE=openai
PERPLEXITY_API_NAME=perplexity  # Optional display name

# Example: GitHub Models API (for use in CI with GitHub tokens)
# Note: Use GitHub token (e.g., from secrets.GITHUB_TOKEN in Actions)
# Available models: gpt-4o, gpt-4o-mini, o1-preview, o1-mini, Phi-3-*, etc.
# See: https://github.com/marketplace/models
#
# For local development with integration tests:
# 1. Create a GitHub Personal Access Token with appropriate permissions
# 2. Or use your GitHub Copilot Pro token
# 3. Run tests with: GITHUB_MODELS_API_KEY=... npm test -- --run llm-integration
GITHUB_MODELS_API_KEY=your-github-token-here
GITHUB_MODELS_API_BASE=https://models.inference.ai.azure.com
GITHUB_MODELS_API_TYPE=openai
GITHUB_MODELS_API_NAME=github  # Optional display name

# Model Aliases
# Define aliases for easier model reference using LM_MODEL_* prefix
# Usage: model: "large" instead of model: "openai:gpt-4o"
LM_MODEL_LARGE=anthropic:claude-3-5-sonnet-20241022
LM_MODEL_FAST=openai:gpt-4o-mini
LM_MODEL_SMART=anthropic:claude-3-opus-20240229

# Testing Configuration
MOCK_PROVIDER_ENABLED=true
TEST_TIMEOUT=10000

# Development Configuration
NODE_ENV=development
DEBUG=lmthing:*

# Langfuse Observability (optional)
# Get API keys from https://cloud.langfuse.com or your self-hosted instance.
# See docker-compose.langfuse.yml for running Langfuse locally.
LANGFUSE_SECRET_KEY=sk-lf-your-secret-key-here
LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key-here
# For local self-hosting use http://localhost:3000; for Langfuse Cloud use https://cloud.langfuse.com
# For US region Cloud: https://us.cloud.langfuse.com
LANGFUSE_BASEURL=http://localhost:3000`}</code>
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
