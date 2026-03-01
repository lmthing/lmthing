import { useEffect, useMemo, useState } from 'react'
import { X, Shield, KeyRound, FileCode2 } from 'lucide-react'
import { useWorkspaceData } from '@/lib/workspaceDataContext'
import type { PackageJson } from '@/types/workspace-data'
import {
  applyEnvToWindowProcessEnv,
  decryptEnvContent,
  encryptEnvContent,
  isValidEnvFileName,
  normalizeEnvFileName,
  parseDotEnv,
} from '@/lib/envCrypto'

interface SettingsViewProps {
  isOpen: boolean
  onClose: () => void
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

export function SettingsView({ isOpen, onClose }: SettingsViewProps) {
  const {
    workspaceData,
    packageJson,
    env,
    updatePackageJson,
    upsertEnvFile,
    deleteEnvFile,
  } = useWorkspaceData()

  const envFileNames = useMemo(() => Object.keys(env).sort(), [env])
  const packageJsonSerialized = useMemo(
    () => (packageJson ? JSON.stringify(packageJson, null, 2) : ''),
    [packageJson]
  )

  const [packageJsonDraft, setPackageJsonDraft] = useState(packageJsonSerialized)
  const [packageJsonError, setPackageJsonError] = useState<string | null>(null)
  const [packageJsonSavedAt, setPackageJsonSavedAt] = useState<string | null>(null)

  const [selectedEnvFile, setSelectedEnvFile] = useState('.env.local')
  const [newEnvFileName, setNewEnvFileName] = useState('.env.local')
  const [envPassword, setEnvPassword] = useState('')
  const [envContent, setEnvContent] = useState('')
  const [envStatus, setEnvStatus] = useState<string | null>(null)
  const [envError, setEnvError] = useState<string | null>(null)
  const [isEnvLoaded, setIsEnvLoaded] = useState(false)
  const [expiresInDays, setExpiresInDays] = useState('30')

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
      ? `Auto-loaded ${effectiveSelectedEnvFile} from session memory (unencrypted).`
      : null

  useEffect(() => {
    if (!isOpen || cachedSessionEnvContent === null) return
    applyEnvToWindowProcessEnv(parseDotEnv(cachedSessionEnvContent))
  }, [isOpen, cachedSessionEnvContent])

  if (!isOpen) return null

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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/65 p-4 md:p-8">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Workspace Settings</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {workspaceData ? `Workspace: ${workspaceData.id}` : 'No workspace selected'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-0 overflow-y-auto lg:overflow-hidden lg:grid-cols-2">
          <section className="flex min-h-0 flex-col border-b border-slate-200 p-5 dark:border-slate-800 lg:border-b-0 lg:border-r lg:overflow-y-auto">
            <div className="mb-3 flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-violet-500" />
              <h3 className="font-medium text-slate-900 dark:text-slate-100">package.json</h3>
            </div>

            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              This editor is bound to workspace `packageJson` and saves directly into workspace data.
            </p>

            <textarea
              value={displayedPackageJsonDraft}
              onChange={(event) => setPackageJsonDraft(event.target.value)}
              spellCheck={false}
              className="min-h-[240px] rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 lg:flex-1"
            />

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

          <section className="flex min-h-0 flex-col p-5 lg:overflow-y-auto">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500" />
              <h3 className="font-medium text-slate-900 dark:text-slate-100">Encrypted env files</h3>
            </div>

            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Env files are stored encrypted in workspace `env`, exported as `.env.*` files, and require a per-file password.
            </p>

            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={newEnvFileName}
                onChange={(event) => setNewEnvFileName(event.target.value)}
                placeholder=".env.local"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                onClick={handleUseEnvFileName}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Select file
              </button>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                    setEnvStatus(`Loaded ${nextFileName} from session memory (unencrypted).`)
                    applyEnvToWindowProcessEnv(parseDotEnv(cachedPlaintext))
                  } else {
                    setEnvContent('')
                  }
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
              <input
                type="password"
                value={envPassword}
                onChange={(event) => setEnvPassword(event.target.value)}
                placeholder="Password for selected file"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <KeyRound className="h-3.5 w-3.5" />
              {selectedEncryptedEnv ? (
                <>
                  <span>Encrypted file selected.</span>
                  {selectedEncryptedEnv.expiresAt && (
                    <span>
                      Expires at {new Date(selectedEncryptedEnv.expiresAt).toLocaleString()}
                    </span>
                  )}
                </>
              ) : (
                <span>New file (not yet saved).</span>
              )}
            </div>

            <textarea
              value={displayedEnvContent}
              onChange={(event) => setEnvContent(event.target.value)}
              placeholder="API_KEY=value"
              spellCheck={false}
              className="min-h-[220px] rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 lg:flex-1"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-500 dark:text-slate-400">
                Lock in days
              </label>
              <input
                type="number"
                min={1}
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(event.target.value)}
                className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                onClick={() => {
                  void handleLoadEnvFile()
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Load / Decrypt
              </button>
              <button
                onClick={() => {
                  void handleSaveEnvFile()
                }}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Encrypt + Save
              </button>
              <button
                onClick={handleDeleteSelectedEnv}
                disabled={!env[effectiveSelectedEnvFile]}
                className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                Delete
              </button>
            </div>

            <div className="mt-2 text-xs">
              {envError ? (
                <span className="text-red-500">{envError}</span>
              ) : envStatus ? (
                <span className="text-emerald-600 dark:text-emerald-400">{envStatus}</span>
              ) : derivedSessionStatus ? (
                <span className="text-emerald-600 dark:text-emerald-400">{derivedSessionStatus}</span>
              ) : isEnvLoaded ? (
                <span className="text-slate-500 dark:text-slate-400">Env file decrypted in editor.</span>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">Choose a file and decrypt or create a new one.</span>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
