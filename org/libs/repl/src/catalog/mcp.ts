import { existsSync, readFileSync } from 'node:fs'
import type { ClassMethodInfo } from '../session/types'

export interface McpServerConfig {
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>
}

export interface McpServerEntry {
  /** PascalCase server name used as the class/namespace in the sandbox (e.g. "Filesystem") */
  name: string
  /** Raw key from mcp.json (e.g. "filesystem") */
  key: string
  /** Tool metadata for the system prompt (populated at load time) */
  methods: ClassMethodInfo[]
  /** Inject this server's tools as a namespace — called when agent runs loadClass(name) */
  inject: (injectGlobal: (name: string, value: unknown) => void) => void
  /** Close the underlying MCP client connection */
  close: () => Promise<void>
}

function toPascalCase(key: string): string {
  return key
    .replace(/[-_\s](.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toUpperCase())
}

function schemaToTypeSig(schema: unknown): string {
  if (!schema || typeof schema !== 'object') return 'any'
  const s = schema as Record<string, unknown>

  if (s.type === 'object') {
    const props = s.properties as Record<string, unknown> | undefined
    if (!props || Object.keys(props).length === 0) return 'Record<string, unknown>'
    const required = new Set<string>(Array.isArray(s.required) ? (s.required as string[]) : [])
    const parts = Object.entries(props).map(([key, val]) => {
      const opt = required.has(key) ? '' : '?'
      return `${key}${opt}: ${leafType(val)}`
    })
    return `{ ${parts.join('; ')} }`
  }

  return leafType(s)
}

function leafType(schema: unknown): string {
  if (!schema || typeof schema !== 'object') return 'any'
  const s = schema as Record<string, unknown>
  switch (s.type) {
    case 'string': return 'string'
    case 'number':
    case 'integer': return 'number'
    case 'boolean': return 'boolean'
    case 'array': return 'any[]'
    case 'null': return 'null'
    case 'object': return 'Record<string, unknown>'
    default: return 'any'
  }
}

/**
 * Connect to a map of MCP servers and return one McpServerEntry per server.
 * This is the core implementation used by both loadMcpServers() and loadMcpServersFromConfig().
 */
export async function loadMcpServersFromConfig(
  mcpServers: Record<string, McpServerConfig>,
  source = 'config',
): Promise<McpServerEntry[]> {
  if (!mcpServers || typeof mcpServers !== 'object' || Object.keys(mcpServers).length === 0) {
    return []
  }

  let Client: any,
    StdioClientTransport: any,
    StreamableHTTPClientTransport: any,
    getDefaultEnvironment: any

  try {
    ;({ Client } = await import('@modelcontextprotocol/sdk/client/index.js' as string))
    ;({ StdioClientTransport, getDefaultEnvironment } = await import('@modelcontextprotocol/sdk/client/stdio.js' as string))
    ;({ StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js' as string))
  } catch {
    throw new Error(
      `MCP servers declared in ${source} but @modelcontextprotocol/sdk is not installed.\n` +
      `Run: pnpm add @modelcontextprotocol/sdk`,
    )
  }

  const entries: McpServerEntry[] = []

  for (const [key, serverConfig] of Object.entries(mcpServers)) {
    const name = toPascalCase(key)

    let transport: unknown
    if (serverConfig.url) {
      transport = new StreamableHTTPClientTransport(
        new URL(serverConfig.url),
        serverConfig.headers ? { requestInit: { headers: serverConfig.headers } } : undefined,
      )
    } else if (serverConfig.command) {
      transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args ?? [],
        env: serverConfig.env
          ? { ...getDefaultEnvironment(), ...serverConfig.env }
          : undefined,
      })
    } else {
      throw new Error(
        `MCP server "${key}" in ${source}: must specify either "command" (stdio) or "url" (HTTP)`,
      )
    }

    const client = new Client({ name: 'lmthing', version: '1.0.0' })
    await client.connect(transport)

    const { tools } = await client.listTools()

    const methods: ClassMethodInfo[] = (tools as any[]).map(tool => ({
      name: tool.name as string,
      description: (tool.description as string) ?? '',
      signature: `(args: ${schemaToTypeSig(tool.inputSchema)}) => Promise<any>`,
    }))

    entries.push({
      name,
      key,
      methods,
      inject(injectGlobal) {
        const bindings: Record<string, (args: unknown) => Promise<unknown>> = {}
        for (const tool of tools as any[]) {
          const toolName = tool.name as string
          bindings[toolName] = async (args: unknown) => {
            const result = await client.callTool({
              name: toolName,
              arguments: (args as Record<string, unknown>) ?? {},
            })
            return result.content
          }
        }
        injectGlobal(name, bindings)
      },
      close: () => client.close(),
    })
  }

  return entries
}

/**
 * Load MCP servers declared in a space's mcp.json.
 * Returns [] if the file does not exist.
 */
export async function loadMcpServers(mcpJsonPath: string): Promise<McpServerEntry[]> {
  if (!existsSync(mcpJsonPath)) return []

  let config: McpConfig
  try {
    config = JSON.parse(readFileSync(mcpJsonPath, 'utf8')) as McpConfig
  } catch (err) {
    throw new Error(`Failed to parse ${mcpJsonPath}: ${err}`)
  }

  return loadMcpServersFromConfig(config.mcpServers ?? {}, mcpJsonPath)
}
