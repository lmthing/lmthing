import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Shield, KeyRound, FileCode2, Sparkles, Search, PackagePlus, Trash2, Info } from 'lucide-react'
import { useWorkspaceData } from '@/lib/workspaceDataContext'
import type { PackageJson } from '@/types/workspace-data'
import {
  applyEnvToWindowProcessEnv,
  decryptEnvContent,
  encryptEnvContent,
  isValidEnvFileName,
  normalizeEnvFileName,
  parseDotEnv,
  stringifyDotEnv,
} from '@/lib/envCrypto'
import { ENV_EXAMPLE_CONTENT } from '@/data/env-example'
import { toWorkspaceRouteParam } from '@/lib/workspaces'

interface SettingsViewProps {
  isOpen: boolean
  onClose: () => void
}

interface ProviderFieldDefinition {
  key: string
  label: string
  required?: boolean
  placeholder?: string
}

interface ProviderDefinition {
  id: string
  label: string
  description: string
  instructions: string
  requiredFields: ProviderFieldDefinition[]
  optionalFields?: ProviderFieldDefinition[]
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

const SUPPORTED_PROVIDERS: ProviderDefinition[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'GPT models via OpenAI.',
    instructions: 'Create an OpenAI API key and paste it below.',
    requiredFields: [{ key: 'OPENAI_API_KEY', label: 'OpenAI API Key', required: true, placeholder: 'sk-...' }],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude models via Anthropic.',
    instructions: 'Create an Anthropic API key and paste it below.',
    requiredFields: [{ key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', required: true, placeholder: 'sk-ant-...' }],
  },
  {
    id: 'google',
    label: 'Google Generative AI',
    description: 'Gemini via Google Generative AI.',
    instructions: 'Create a Google AI key for the Generative AI API.',
    requiredFields: [{ key: 'GOOGLE_GENERATIVE_AI_API_KEY', label: 'Google API Key', required: true, placeholder: 'AIza...' }],
  },
  {
    id: 'vertex',
    label: 'Google Vertex AI',
    description: 'Gemini via Google Vertex AI.',
    instructions: 'Set your GCP project and location for Vertex AI.',
    requiredFields: [
      { key: 'GOOGLE_VERTEX_PROJECT', label: 'GCP Project ID', required: true, placeholder: 'my-project' },
    ],
    optionalFields: [
      { key: 'GOOGLE_VERTEX_LOCATION', label: 'Vertex Location', placeholder: 'us-central1' },
    ],
  },
  {
    id: 'mistral',
    label: 'Mistral',
    description: 'Mistral hosted models.',
    instructions: 'Create a Mistral API key.',
    requiredFields: [{ key: 'MISTRAL_API_KEY', label: 'Mistral API Key', required: true, placeholder: '...' }],
  },
  {
    id: 'azure',
    label: 'Azure OpenAI',
    description: 'Azure-hosted OpenAI models.',
    instructions: 'Provide Azure OpenAI key and resource name (deployment is model id at runtime).',
    requiredFields: [
      { key: 'AZURE_API_KEY', label: 'Azure API Key', required: true, placeholder: '...' },
      { key: 'AZURE_RESOURCE_NAME', label: 'Azure Resource Name', required: true, placeholder: 'my-openai-resource' },
    ],
  },
  {
    id: 'groq',
    label: 'Groq',
    description: 'Fast inference via Groq.',
    instructions: 'Create a Groq API key.',
    requiredFields: [{ key: 'GROQ_API_KEY', label: 'Groq API Key', required: true, placeholder: 'gsk_...' }],
  },
  {
    id: 'cohere',
    label: 'Cohere',
    description: 'Cohere command models.',
    instructions: 'Create a Cohere API key.',
    requiredFields: [{ key: 'COHERE_API_KEY', label: 'Cohere API Key', required: true, placeholder: '...' }],
  },
  {
    id: 'bedrock',
    label: 'Amazon Bedrock',
    description: 'AWS Bedrock-hosted models.',
    instructions: 'Set AWS credentials and region for Bedrock access.',
    requiredFields: [
      { key: 'AWS_ACCESS_KEY_ID', label: 'AWS Access Key ID', required: true, placeholder: 'AKIA...' },
      { key: 'AWS_SECRET_ACCESS_KEY', label: 'AWS Secret Access Key', required: true, placeholder: '...' },
    ],
    optionalFields: [
      { key: 'AWS_REGION', label: 'AWS Region', placeholder: 'us-east-1' },
      { key: 'AWS_SESSION_TOKEN', label: 'AWS Session Token (optional)', placeholder: '...' },
    ],
  },
  {
    id: 'custom-openai',
    label: 'Custom OpenAI-Compatible',
    description: 'Any OpenAI-compatible endpoint.',
    instructions:
      'Set a provider prefix (e.g. ZAI), key, base URL, and API type openai. Optional display name is used in model ids.',
    requiredFields: [
      { key: 'PREFIX', label: 'Provider Prefix', required: true, placeholder: 'ZAI' },
      { key: 'API_KEY', label: 'API Key', required: true, placeholder: '...' },
      { key: 'API_BASE', label: 'API Base URL', required: true, placeholder: 'https://api.example.com/v1' },
      { key: 'API_TYPE', label: 'API Type', required: true, placeholder: 'openai' },
    ],
    optionalFields: [
      { key: 'API_NAME', label: 'Display Name (optional)', placeholder: 'zai' },
    ],
  },
]

function getProviderColorClass(providerId: string): string {
  const palette: Record<string, string> = {
    openai: 'from-emerald-500 to-green-600',
    anthropic: 'from-amber-500 to-orange-600',
    google: 'from-blue-500 to-cyan-600',
    vertex: 'from-indigo-500 to-blue-700',
    mistral: 'from-fuchsia-500 to-pink-600',
    azure: 'from-sky-500 to-blue-600',
    groq: 'from-violet-500 to-purple-700',
    cohere: 'from-rose-500 to-red-600',
    bedrock: 'from-yellow-500 to-amber-700',
    'custom-openai': 'from-slate-600 to-slate-800',
  }

  return `bg-gradient-to-r text-white shadow-md ${palette[providerId] || 'from-slate-500 to-slate-700'}`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function upsertDotEnvEntries(content: string, entries: Array<[string, string]>): string {
  const lines = content.length > 0 ? content.split(/\r?\n/) : []
  const seen = new Set<string>()

  for (const [key, value] of entries) {
    const safeKey = key.trim()
    if (!safeKey || seen.has(safeKey)) continue
    seen.add(safeKey)

    const pattern = new RegExp(`^\\s*(?:export\\s+)?${escapeRegExp(safeKey)}\\s*=`)
    const nextLine = `${safeKey}=${value}`
    const existingIndex = lines.findIndex((line) => pattern.test(line))

    if (existingIndex >= 0) {
      lines[existingIndex] = nextLine
    } else {
      lines.push(nextLine)
    }
  }

  return lines.join('\n').replace(/^\n+/, '')
}

function removeDotEnvEntry(content: string, keyToRemove: string): string {
  const pattern = new RegExp(`^\\s*(?:export\\s+)?${escapeRegExp(keyToRemove)}\\s*=`)
  return content
    .split(/\r?\n/)
    .filter((line) => !pattern.test(line))
    .join('\n')
}

function normalizeAliasName(aliasName: string): string {
  return aliasName
    .trim()
    .replace(/^LM_MODEL_/i, '')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
}

function getDefaultProviderInputValues(provider: ProviderDefinition): Record<string, string> {
  const base: Record<string, string> = {}

  if (provider.id === 'custom-openai') {
    base.PREFIX = 'CUSTOM'
    base.API_TYPE = 'openai'
  }

  if (provider.id === 'vertex') {
    base.GOOGLE_VERTEX_LOCATION = 'us-central1'
  }

  if (provider.id === 'bedrock') {
    base.AWS_REGION = 'us-east-1'
  }

  return base
}

function isProviderConfigured(provider: ProviderDefinition, envMap: Record<string, string>): boolean {
  if (provider.id === 'custom-openai') return false

  return provider.requiredFields.every((field) => {
    const value = envMap[field.key]
    return typeof value === 'string' && value.trim().length > 0
  })
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
  } = useWorkspaceData()

  // Determine active tab from URL - default to env
  const activeTab = useMemo(() => {
    if (location.pathname.includes('/settings/package-json')) return 'package-json'
    return 'env' // default to env tab
  }, [location.pathname])

  const handleTabChange = (tab: 'env' | 'package-json') => {
    if (!workspaceName) return
    const basePath = `/workspace/${workspaceName}/studio/settings`
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
  const [selectedProviderId, setSelectedProviderId] = useState(SUPPORTED_PROVIDERS[0].id)
  const [providerDraftValues, setProviderDraftValues] = useState<Record<string, string>>(
    getDefaultProviderInputValues(SUPPORTED_PROVIDERS[0])
  )
  const [aliasDraftName, setAliasDraftName] = useState('')
  const [aliasDraftModel, setAliasDraftModel] = useState('')

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
  const parsedEnvMap = useMemo(() => parseDotEnv(displayedEnvContent), [displayedEnvContent])
  const selectedProvider =
    SUPPORTED_PROVIDERS.find((provider) => provider.id === selectedProviderId) ||
    SUPPORTED_PROVIDERS[0]
  const derivedSessionStatus =
    !envStatus && cachedSessionEnvContent !== null
      ? `Auto-loaded ${effectiveSelectedEnvFile} from session memory (unencrypted).`
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

  const handleAddProvider = () => {
    const entries: Array<[string, string]> = []

    if (selectedProvider.id === 'custom-openai') {
      const normalizedPrefix = (providerDraftValues.PREFIX || '')
        .trim()
        .replace(/[^A-Za-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase()

      if (!normalizedPrefix) {
        setEnvError('Custom provider prefix is required (e.g. ZAI).')
        return
      }

      const apiKey = (providerDraftValues.API_KEY || '').trim()
      const apiBase = (providerDraftValues.API_BASE || '').trim()
      const apiType = (providerDraftValues.API_TYPE || '').trim() || 'openai'
      const apiName = (providerDraftValues.API_NAME || '').trim()

      if (!apiKey || !apiBase || !apiType) {
        setEnvError('Custom provider requires API key, API base URL, and API type.')
        return
      }

      entries.push([`${normalizedPrefix}_API_KEY`, apiKey])
      entries.push([`${normalizedPrefix}_API_BASE`, apiBase])
      entries.push([`${normalizedPrefix}_API_TYPE`, apiType])
      if (apiName) entries.push([`${normalizedPrefix}_API_NAME`, apiName])
    } else {
      for (const field of selectedProvider.requiredFields) {
        const value = (providerDraftValues[field.key] || '').trim()
        if (!value) {
          setEnvError(`${field.label} is required.`)
          return
        }
        entries.push([field.key, value])
      }

      selectedProvider.optionalFields?.forEach((field) => {
        const value = (providerDraftValues[field.key] || '').trim()
        if (value) entries.push([field.key, value])
      })
    }

    const nextContent = upsertDotEnvEntries(displayedEnvContent, entries)
    setEnvContent(nextContent)
    setIsEnvLoaded(true)
    setEnvError(null)
    setEnvStatus(`${selectedProvider.label} variables added to ${effectiveSelectedEnvFile}.`)
    applyEnvToWindowProcessEnv(parseDotEnv(nextContent))
  }

  const handleAddAlias = () => {
    const normalizedAlias = normalizeAliasName(aliasDraftName)
    const modelId = aliasDraftModel.trim()

    if (!normalizedAlias) {
      setEnvError('Alias name is required (example: FAST).')
      return
    }

    if (!modelId) {
      setEnvError('Alias model target is required (example: openai:gpt-4o-mini).')
      return
    }

    const nextContent = upsertDotEnvEntries(displayedEnvContent, [[`LM_MODEL_${normalizedAlias}`, modelId]])
    setEnvContent(nextContent)
    setIsEnvLoaded(true)
    setEnvError(null)
    setEnvStatus(`LM_MODEL_${normalizedAlias} added to ${effectiveSelectedEnvFile}.`)
    setAliasDraftName('')
    setAliasDraftModel('')
    applyEnvToWindowProcessEnv(parseDotEnv(nextContent))
  }

  const handleUpdateAliasValue = (aliasKey: string, value: string) => {
    const nextValue = value.trim()

    const nextContent = upsertDotEnvEntries(displayedEnvContent, [[aliasKey, nextValue]])
    setEnvContent(nextContent)
    setIsEnvLoaded(true)
    setEnvError(null)
    setEnvStatus(`${aliasKey} updated.`)
    applyEnvToWindowProcessEnv(parseDotEnv(nextContent))
  }

  const handleDeleteAlias = (aliasKey: string) => {
    const nextContent = removeDotEnvEntry(displayedEnvContent, aliasKey)
    setEnvContent(nextContent)
    setIsEnvLoaded(true)
    setEnvError(null)
    setEnvStatus(`${aliasKey} removed.`)
    applyEnvToWindowProcessEnv(parseDotEnv(nextContent))
  }

  const detectedAliases = useMemo(() => {
    return Object.keys(parsedEnvMap)
      .filter((key) => key.startsWith('LM_MODEL_'))
      .sort((a, b) => a.localeCompare(b))
  }, [parsedEnvMap])

  const aliasEntries = useMemo(
    () => detectedAliases.map((key) => ({ key, value: parsedEnvMap[key] || '' })),
    [detectedAliases, parsedEnvMap]
  )

  const availableProviders = useMemo(() => {
    const builtIn = SUPPORTED_PROVIDERS
      .filter((provider) => provider.id !== 'custom-openai')
      .filter((provider) => isProviderConfigured(provider, parsedEnvMap))
      .map((provider) => ({
        id: provider.id,
        label: provider.label,
        description: provider.description,
      }))

    const customPrefixes = Object.entries(parsedEnvMap)
      .filter(([key, value]) => key.endsWith('_API_TYPE') && value === 'openai')
      .map(([key]) => key.replace(/_API_TYPE$/, ''))
      .filter((prefix) => {
        const keyValue = parsedEnvMap[`${prefix}_API_KEY`]
        const baseValue = parsedEnvMap[`${prefix}_API_BASE`]
        return Boolean(keyValue && baseValue)
      })

    const custom = customPrefixes.map((prefix) => {
      const displayName = parsedEnvMap[`${prefix}_API_NAME`] || prefix.toLowerCase()
      return {
        id: `custom-${prefix}`,
        label: `Custom: ${displayName}`,
        description: 'OpenAI-compatible provider',
      }
    })

    return [...builtIn, ...custom]
  }, [parsedEnvMap])

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
          <section className="flex min-h-0 flex-col p-5">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500" />
              <h3 className="font-medium text-slate-900 dark:text-slate-100">Encrypted env files</h3>
            </div>

            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Env files are stored encrypted in workspace `env`, exported as `.env.*` files, and require a per-file password.
            </p>

            <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900/40 dark:bg-blue-950/20">
              <Info className="h-4 w-4 flex-shrink-0 text-blue-500" />
              <p className="text-xs text-slate-600 dark:text-slate-300">
                For configuration examples, see{' '}
                <a
                  href="#file:lib/core/.env.example"
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  .env.example
                </a>
              </p>
            </div>

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

            <div className="mb-4 rounded-2xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-sky-50 to-emerald-50 p-4 shadow-sm dark:border-fuchsia-900/40 dark:from-fuchsia-950/20 dark:via-slate-900 dark:to-emerald-950/20">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-fuchsia-500" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Provider & alias studio</h4>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Add providers and LM_MODEL aliases without exposing env values.
              </p>

              <div className="mt-3 rounded-xl border border-white/80 bg-white/75 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Add provider</p>

                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                  <select
                    value={selectedProvider.id}
                    onChange={(event) => {
                      const nextProvider =
                        SUPPORTED_PROVIDERS.find((provider) => provider.id === event.target.value) ||
                        SUPPORTED_PROVIDERS[0]
                      setSelectedProviderId(nextProvider.id)
                      setProviderDraftValues(getDefaultProviderInputValues(nextProvider))
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {SUPPORTED_PROVIDERS.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddProvider}
                    className="rounded-md bg-fuchsia-600 px-3 py-2 text-sm font-medium text-white hover:bg-fuchsia-700"
                  >
                    Add provider
                  </button>
                </div>

                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{selectedProvider.instructions}</p>

                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[...selectedProvider.requiredFields, ...(selectedProvider.optionalFields || [])].map((field) => (
                    <input
                      key={`${selectedProvider.id}-${field.key}`}
                      value={providerDraftValues[field.key] || ''}
                      onChange={(event) =>
                        setProviderDraftValues((previous) => ({
                          ...previous,
                          [field.key]: event.target.value,
                        }))
                      }
                      placeholder={field.placeholder || field.label}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  ))}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availableProviders.length > 0 ? (
                  availableProviders.map((provider) => (
                    <div
                      key={provider.id}
                      className={`rounded-xl border border-transparent px-3 py-2 text-left text-xs ${getProviderColorClass(provider.id.includes('custom-') ? 'custom-openai' : provider.id)}`}
                    >
                      <div className="font-semibold">{provider.label}</div>
                      <div className="mt-1 text-white/85">{provider.description}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400 sm:col-span-2">
                    No available providers found from current env vars.
                  </div>
                )}
              </div>

              <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">LM_MODEL aliases</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr_auto]">
                  <input
                    value={aliasDraftName}
                    onChange={(event) => setAliasDraftName(event.target.value)}
                    placeholder="FAST"
                    className="rounded-md border border-indigo-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-indigo-900/60 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <input
                    value={aliasDraftModel}
                    onChange={(event) => setAliasDraftModel(event.target.value)}
                    placeholder="openai:gpt-4o-mini"
                    className="rounded-md border border-indigo-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-indigo-900/60 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <button
                    onClick={handleAddAlias}
                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Add alias
                  </button>
                </div>
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                  {aliasEntries.length > 0 ? (
                    aliasEntries.map((alias) => (
                      <div
                        key={alias.key}
                        className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr_auto]"
                      >
                        <div className="rounded-md border border-indigo-300 bg-white px-3 py-2 text-xs font-medium text-indigo-700 dark:border-indigo-900/60 dark:bg-slate-950 dark:text-indigo-300">
                          {alias.key}
                        </div>
                        <input
                          value={alias.value}
                          onChange={(event) => handleUpdateAliasValue(alias.key, event.target.value)}
                          placeholder="provider:model"
                          className="rounded-md border border-indigo-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-indigo-900/60 dark:bg-slate-950 dark:text-slate-100"
                        />
                        <button
                          onClick={() => handleDeleteAlias(alias.key)}
                          className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-600 dark:text-slate-300">No aliases detected.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
              <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Raw env file editor
              </p>
              <textarea
                value={displayedEnvContent}
                onChange={(event) => {
                  setEnvContent(event.target.value)
                  setIsEnvLoaded(true)
                }}
                spellCheck={false}
                placeholder="KEY=value\nANOTHER_KEY=another_value"
                className="min-h-[200px] w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

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
                onClick={() => {
                  const normalized = stringifyDotEnv(parseDotEnv(displayedEnvContent))
                  setEnvContent(normalized)
                  setEnvStatus(`Normalized ${effectiveSelectedEnvFile} formatting.`)
                  setEnvError(null)
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Normalize
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
