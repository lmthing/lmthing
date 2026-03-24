/**
 * Agent namespaces — builds callable namespace globals from loaded space agents.
 *
 * Each space becomes a namespace object with own agents as direct properties
 * and dependency-space agents nested under sub-namespace properties.
 *
 * Usage: cooking.general_advisor({ technique: "saute" }).mealplan("How to cook a steak?")
 * Deps:  cooking.french_cooking.chef({}).recipe("Make bouillabaisse")
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve, basename } from 'node:path'
import { loadAgent } from './cli/agent-loader'
import type { AgentAction, LoadedAgent } from './cli/agent-loader'
import { saveKnowledgeFile, deleteKnowledgeFile, parseFieldPath } from '@lmthing/repl'
import type { KnowledgeTree, KnowledgeDomain, KnowledgeField, AgentSpawnConfig, AgentSpawnResult } from '@lmthing/repl'

// ── Types ──

export interface SpaceAgentTree {
  spaceName: string
  spaceDir: string
  agents: AgentEntry[]
  dependencies: DependencyTree[]
}

export interface DependencyTree {
  namespaceName: string
  uri: string
  spaceDir: string | null
  agents: AgentEntry[]
}

export interface AgentEntry {
  slug: string
  rawSlug: string
  title: string
  actions: AgentAction[]
  paramSchema: ParamSchema
}

export interface ParamSchema {
  domains: Record<string, DomainParam>
}

export interface DomainParam {
  fields: Record<string, { optional: boolean; enum?: string[] }>
}

// ── Slug Conversion ──

export function toNamespaceId(name: string, prefix?: string): string {
  let result = name
  if (prefix && result.startsWith(prefix)) {
    result = result.slice(prefix.length)
  }
  return result.replace(/-/g, '_')
}

// ── Space Dependencies ──

export function readSpaceDependencies(
  spaceDir: string,
): Map<string, { namespaceName: string; spaceDir: string | null }> {
  const result = new Map<string, { namespaceName: string; spaceDir: string | null }>()

  const pkgPath = join(spaceDir, 'package.json')
  if (!existsSync(pkgPath)) return result

  let pkg: Record<string, any>
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  } catch {
    return result
  }

  const spaces = pkg.spaces
  if (!spaces || typeof spaces !== 'object') return result

  for (const [uri, _version] of Object.entries(spaces)) {
    let namespaceName: string
    let resolvedDir: string | null = null

    if (uri.startsWith('npm:')) {
      // npm:@scope/french-cooking → french_cooking
      const segments = uri.split('/')
      const last = segments[segments.length - 1]
      namespaceName = toNamespaceId(last)
    } else if (uri.startsWith('github:')) {
      // github:org/repo/italian-cooking → italian_cooking
      const segments = uri.split('/')
      const last = segments[segments.length - 1]
      namespaceName = toNamespaceId(last)
    } else {
      // Local path
      const absPath = resolve(spaceDir, uri)
      if (existsSync(absPath)) {
        resolvedDir = absPath
        // Try to read package.json name
        const depPkgPath = join(absPath, 'package.json')
        if (existsSync(depPkgPath)) {
          try {
            const depPkg = JSON.parse(readFileSync(depPkgPath, 'utf-8'))
            namespaceName = toNamespaceId(depPkg.name ?? basename(absPath))
          } catch {
            namespaceName = toNamespaceId(basename(absPath))
          }
        } else {
          namespaceName = toNamespaceId(basename(absPath))
        }
      } else {
        namespaceName = toNamespaceId(basename(uri))
      }
    }

    result.set(uri, { namespaceName, spaceDir: resolvedDir })
  }

  return result
}

// ── Param Schema Extraction ──

export function extractParamSchema(
  knowledgeDefaults: Record<string, any>,
  knowledgeTree?: KnowledgeTree,
): ParamSchema {
  const domains: Record<string, DomainParam> = {}

  for (const [domainSlug, fieldSpec] of Object.entries(knowledgeDefaults)) {
    if (typeof fieldSpec !== 'object' || fieldSpec === null) continue

    const fields: Record<string, { optional: boolean; enum?: string[] }> = {}

    for (const [fieldSlug, value] of Object.entries(fieldSpec as Record<string, any>)) {
      if (value === false) continue // hidden field

      // Find enum values from knowledge tree
      let enumValues: string[] | undefined
      if (knowledgeTree) {
        const domain = knowledgeTree.domains.find(d => d.slug === domainSlug)
        if (domain) {
          const field = domain.fields.find(f => f.slug === fieldSlug)
          if (field && field.options.length > 0) {
            enumValues = field.options.map(o => o.slug)
          }
        }
      }

      fields[fieldSlug] = {
        optional: true,
        ...(enumValues ? { enum: enumValues } : {}),
      }
    }

    if (Object.keys(fields).length > 0) {
      domains[domainSlug] = { fields }
    }
  }

  return { domains }
}

// ── Agent Tree Building ──

export function buildSpaceAgentTrees(
  spacePaths: string[],
  knowledgeTrees: KnowledgeTree[],
): SpaceAgentTree[] {
  const trees: SpaceAgentTree[] = []

  for (let i = 0; i < spacePaths.length; i++) {
    const spaceDir = spacePaths[i]
    const knowledgeTree = knowledgeTrees[i]

    // Derive space name from package.json or directory
    const pkgPath = join(spaceDir, 'package.json')
    let spaceName: string
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        spaceName = toNamespaceId(pkg.name ?? basename(spaceDir), 'space-')
      } catch {
        spaceName = toNamespaceId(basename(spaceDir), 'space-')
      }
    } else {
      spaceName = toNamespaceId(basename(spaceDir), 'space-')
    }

    // Load own agents
    const agentsDir = join(spaceDir, 'agents')
    const ownAgents: AgentEntry[] = []
    if (existsSync(agentsDir)) {
      const agentDirs = readdirSync(agentsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)

      for (const rawSlug of agentDirs) {
        try {
          const loaded = loadAgent(spaceDir, rawSlug)
          const slug = toNamespaceId(rawSlug, 'agent-')
          const paramSchema = extractParamSchema(loaded.knowledgeDefaults, knowledgeTree)
          ownAgents.push({
            slug,
            rawSlug,
            title: loaded.title,
            actions: loaded.actions,
            paramSchema,
          })
        } catch {
          // Skip agents that fail to load
        }
      }
    }

    // Read dependencies
    const deps = readSpaceDependencies(spaceDir)
    const dependencies: DependencyTree[] = []

    // For each agent, resolve which dependency agents are enabled
    // We take the union of all agents' enabledAgents
    const allEnabledAgents = new Map<string, string[] | true>()
    for (const agent of ownAgents) {
      try {
        const loaded = loadAgent(spaceDir, agent.rawSlug)
        for (const [uri, filter] of Object.entries(loaded.enabledAgents)) {
          const existing = allEnabledAgents.get(uri)
          if (existing === true || filter === true) {
            allEnabledAgents.set(uri, true)
          } else if (existing) {
            // Merge arrays
            const merged = [...new Set([...existing, ...filter as string[]])]
            allEnabledAgents.set(uri, merged)
          } else {
            allEnabledAgents.set(uri, filter)
          }
        }
      } catch {
        // skip
      }
    }

    for (const [uri, depInfo] of deps) {
      const enabledFilter = allEnabledAgents.get(uri)
      if (!enabledFilter) continue // No agent enables this dependency

      const depAgents: AgentEntry[] = []

      if (depInfo.spaceDir) {
        // Local dependency — load agents
        const depAgentsDir = join(depInfo.spaceDir, 'agents')
        if (existsSync(depAgentsDir)) {
          const agentDirs = readdirSync(depAgentsDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name)

          for (const rawSlug of agentDirs) {
            // Check filter
            const slug = toNamespaceId(rawSlug, 'agent-')
            if (enabledFilter !== true && !enabledFilter.includes(rawSlug) && !enabledFilter.includes(slug)) {
              continue
            }

            try {
              const loaded = loadAgent(depInfo.spaceDir!, rawSlug)

              // Find knowledge tree for dep space if available
              let depKnowledgeTree: KnowledgeTree | undefined
              const depKDir = join(depInfo.spaceDir!, 'knowledge')
              if (existsSync(depKDir)) {
                // We don't have pre-built trees for deps, so paramSchema will be basic
              }

              const paramSchema = extractParamSchema(loaded.knowledgeDefaults, depKnowledgeTree)
              depAgents.push({
                slug,
                rawSlug,
                title: loaded.title,
                actions: loaded.actions,
                paramSchema,
              })
            } catch {
              // Skip
            }
          }
        }
      }

      dependencies.push({
        namespaceName: depInfo.namespaceName,
        uri,
        spaceDir: depInfo.spaceDir,
        agents: depAgents,
      })
    }

    trees.push({ spaceName, spaceDir, agents: ownAgents, dependencies })
  }

  return trees
}

// ── Namespace Globals ──

export type OnSpawnFn = (config: AgentSpawnConfig) => Promise<AgentSpawnResult>

export function createNamespaceGlobals(
  trees: SpaceAgentTree[],
  onSpawn: OnSpawnFn,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const tree of trees) {
    result[tree.spaceName] = buildSpaceNamespace(tree, onSpawn)
  }

  return result
}

function buildSpaceNamespace(
  tree: SpaceAgentTree,
  onSpawn: OnSpawnFn,
): object {
  const ns: Record<string, any> = {}

  // Own agents
  for (const agent of tree.agents) {
    ns[agent.slug] = buildAgentCallable(tree.spaceDir, tree.spaceName, agent, onSpawn)
  }

  // Dependency spaces (nested)
  for (const dep of tree.dependencies) {
    if (!dep.spaceDir) continue
    const depNs: Record<string, any> = {}
    for (const agent of dep.agents) {
      depNs[agent.slug] = buildAgentCallable(dep.spaceDir, dep.namespaceName, agent, onSpawn)
    }
    if (Object.keys(depNs).length > 0) {
      ns[dep.namespaceName] = depNs
    }
  }

  return ns
}

function buildAgentCallable(
  spaceDir: string,
  spaceName: string,
  agent: AgentEntry,
  onSpawn: OnSpawnFn,
): (params?: Record<string, any>) => Record<string, Function> {
  return (params: Record<string, any> = {}) => {
    const actions: Record<string, Function> = {}
    for (const action of agent.actions) {
      actions[action.id] = (request: string) => {
        return new ChainableSpawnPromise(onSpawn, {
          spaceDir,
          spaceName,
          agentSlug: agent.rawSlug,
          actionId: action.id,
          request,
          params,
          options: { context: 'empty' },
        })
      }
    }
    return actions
  }
}

// ── ChainableSpawnPromise ──

export class ChainableSpawnPromise implements PromiseLike<AgentSpawnResult> {
  private config: AgentSpawnConfig
  private onSpawn: OnSpawnFn
  private innerPromise: Promise<AgentSpawnResult>
  private resolveFn!: (value: AgentSpawnResult) => void
  private rejectFn!: (reason: any) => void
  private started = false

  constructor(onSpawn: OnSpawnFn, config: AgentSpawnConfig) {
    this.onSpawn = onSpawn
    this.config = { ...config }
    this.innerPromise = new Promise<AgentSpawnResult>((resolve, reject) => {
      this.resolveFn = resolve
      this.rejectFn = reject
    })
    // Defer start via microtask so .options() can be chained
    Promise.resolve().then(() => this.start())
  }

  options(opts: { context?: 'empty' | 'branch' }): this {
    if (!this.started) {
      if (opts.context) {
        this.config.options = { ...this.config.options, context: opts.context }
      }
    }
    return this
  }

  then<TResult1 = AgentSpawnResult, TResult2 = never>(
    onfulfilled?: ((value: AgentSpawnResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.innerPromise.then(onfulfilled, onrejected)
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<AgentSpawnResult | TResult> {
    return this.innerPromise.catch(onrejected)
  }

  finally(onfinally?: (() => void) | null): Promise<AgentSpawnResult> {
    return this.innerPromise.finally(onfinally)
  }

  private start(): void {
    if (this.started) return
    this.started = true
    // Pass self as _originPromise so executeSpawn can link childSession to registry entry
    const configWithRef = { ...this.config, _originPromise: this }
    this.onSpawn(configWithRef).then(this.resolveFn, this.rejectFn)
  }
}

// ── Knowledge Namespace ──

export interface KnowledgeNamespaceConfig {
  /** Path to the knowledge space's knowledge/ directory. */
  knowledgeDir: string
  /** Called after a save or remove operation. */
  onKnowledgeSaved?: (domain: string, field: string, option: string) => void
  /** Called after a remove operation. */
  onKnowledgeRemoved?: (domain: string, field: string, option: string) => void
}

/**
 * Build the built-in `knowledge` namespace.
 *
 * Unlike space-derived namespaces that spawn child agent sessions,
 * the knowledge namespace performs direct file I/O via writer.ts.
 * Actions resolve immediately without an LLM round-trip.
 */
export function createKnowledgeNamespace(config: KnowledgeNamespaceConfig): Record<string, unknown> {
  return {
    writer: (params: { field: string }) => {
      const { domain, field } = parseFieldPath(params.field)

      return {
        save: (option: string, content: string): Promise<void> => {
          return Promise.resolve().then(() => {
            saveKnowledgeFile(config.knowledgeDir, domain, field, option, content)
            config.onKnowledgeSaved?.(domain, field, option)
          })
        },

        remove: (option: string): Promise<boolean> => {
          return Promise.resolve().then(() => {
            const deleted = deleteKnowledgeFile(config.knowledgeDir, domain, field, option)
            if (deleted) {
              config.onKnowledgeRemoved?.(domain, field, option)
            }
            return deleted
          })
        },

        addOptions: (description: string, ...data: any[]): Promise<void> => {
          return Promise.resolve().then(() => {
            for (let i = 0; i < data.length; i++) {
              const item = data[i]
              let optionSlug: string
              let content: string

              if (typeof item === 'string') {
                // Derive slug from first line or index
                const firstLine = item.split('\n')[0].trim()
                optionSlug = firstLine
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, '')
                  .slice(0, 50) || `option-${i}`
                content = item
              } else if (item && typeof item === 'object') {
                // Use name/title/id as slug, JSON-stringify the rest
                optionSlug = (item.name ?? item.title ?? item.id ?? `option-${i}`)
                  .toString()
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, '')
                  .slice(0, 50)
                content = typeof item.content === 'string'
                  ? item.content
                  : JSON.stringify(item, null, 2)
              } else {
                optionSlug = `option-${i}`
                content = String(item)
              }

              saveKnowledgeFile(config.knowledgeDir, domain, field, optionSlug, content)
            }
            config.onKnowledgeSaved?.(domain, field, `${data.length} options`)
          })
        },
      }
    },
  }
}

/**
 * Format the knowledge namespace for the system prompt's agent tree.
 */
export function formatKnowledgeNamespaceForPrompt(): string {
  return `knowledge {
  writer({ field: string }): {
    save(option: string, content: string): Promise<void>;
    remove(option: string): Promise<boolean>;
    addOptions(description: string, ...data: any[]): Promise<void>;
  }
}`
}

// ── Prompt Formatting ──

export function formatAgentTreeForPrompt(trees: SpaceAgentTree[]): string {
  const lines: string[] = []

  for (const tree of trees) {
    lines.push(`${tree.spaceName} {`)

    for (const agent of tree.agents) {
      const paramStr = formatParamSchema(agent.paramSchema)
      lines.push(`  ${agent.slug}(${paramStr}): {`)
      for (const action of agent.actions) {
        lines.push(`    ${action.id}(request: string): Promise<SpawnResult>;`)
      }
      lines.push(`  }`)
    }

    for (const dep of tree.dependencies) {
      if (dep.agents.length === 0 && !dep.spaceDir) {
        lines.push(`  ${dep.namespaceName} { /* unresolvable: ${dep.uri} */ }`)
        continue
      }
      if (dep.agents.length === 0) continue

      lines.push(`  ${dep.namespaceName} {`)
      for (const agent of dep.agents) {
        const paramStr = formatParamSchema(agent.paramSchema)
        lines.push(`    ${agent.slug}(${paramStr}): {`)
        for (const action of agent.actions) {
          lines.push(`      ${action.id}(request: string): Promise<SpawnResult>;`)
        }
        lines.push(`    }`)
      }
      lines.push(`  }`)
    }

    lines.push(`}`)
  }

  return lines.join('\n')
}

function formatParamSchema(schema: ParamSchema): string {
  const domainParts: string[] = []

  for (const [domainSlug, domain] of Object.entries(schema.domains)) {
    const fieldParts: string[] = []
    for (const [fieldSlug, field] of Object.entries(domain.fields)) {
      const enumStr = field.enum ? field.enum.map(e => `'${e}'`).join(' | ') : 'string'
      fieldParts.push(`${fieldSlug}?: ${enumStr}`)
    }
    domainParts.push(`${domainSlug}?: { ${fieldParts.join(', ')} }`)
  }

  if (domainParts.length === 0) return '{}'
  return `{ ${domainParts.join(', ')} }`
}
