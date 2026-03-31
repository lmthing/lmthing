import { describe, it, expect, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { loadMcpServers } from './mcp'

// Resolve absolute SDK paths so the server script works from /tmp (no node_modules there)
const sdkServer = fileURLToPath(import.meta.resolve('@modelcontextprotocol/sdk/server/index.js'))
const sdkStdio = fileURLToPath(import.meta.resolve('@modelcontextprotocol/sdk/server/stdio.js'))
const sdkTypes = fileURLToPath(import.meta.resolve('@modelcontextprotocol/sdk/types.js'))

// ── Minimal stdio MCP server script used in integration tests ──
const TEST_SERVER_SCRIPT = `
import { Server } from '${sdkServer}'
import { StdioServerTransport } from '${sdkStdio}'
import { ListToolsRequestSchema, CallToolRequestSchema } from '${sdkTypes}'

const server = new Server(
  { name: 'test-server', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'echo',
      description: 'Echo text back',
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
    {
      name: 'add',
      description: 'Add two numbers',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
        },
        required: ['a', 'b'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = req.params.arguments ?? {}
  if (req.params.name === 'echo') {
    return { content: [{ type: 'text', text: String(args.text) }] }
  }
  if (req.params.name === 'add') {
    return { content: [{ type: 'text', text: String(Number(args.a) + Number(args.b)) }] }
  }
  return { content: [{ type: 'text', text: 'unknown tool' }] }
})

const transport = new StdioServerTransport()
await server.connect(transport)
`

function makeTmpDir() {
  const dir = join(tmpdir(), `mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('loadMcpServers', () => {
  const tmpDirs: string[] = []

  afterEach(() => {
    for (const dir of tmpDirs) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
    tmpDirs.length = 0
  })

  it('returns empty array when file does not exist', async () => {
    const result = await loadMcpServers('/tmp/nonexistent-mcp-12345.json')
    expect(result).toEqual([])
  })

  it('returns empty array when mcpServers key is missing', async () => {
    const dir = makeTmpDir()
    tmpDirs.push(dir)
    const path = join(dir, 'mcp.json')
    writeFileSync(path, JSON.stringify({ other: 'stuff' }))
    const result = await loadMcpServers(path)
    expect(result).toEqual([])
  })

  describe('with a real stdio server', () => {
    function makeServerConfig(dir: string) {
      const serverPath = join(dir, 'server.mjs')
      const mcpJsonPath = join(dir, 'mcp.json')
      writeFileSync(serverPath, TEST_SERVER_SCRIPT)
      writeFileSync(mcpJsonPath, JSON.stringify({
        mcpServers: {
          'test-tools': {
            command: 'node',
            args: [serverPath],
          },
        },
      }))
      return mcpJsonPath
    }

    it('connects to server and discovers tools', async () => {
      const dir = makeTmpDir()
      tmpDirs.push(dir)
      const mcpJsonPath = makeServerConfig(dir)

      const servers = await loadMcpServers(mcpJsonPath)
      expect(servers).toHaveLength(1)

      const [server] = servers
      expect(server.key).toBe('test-tools')
      expect(server.name).toBe('TestTools')
      expect(server.methods).toHaveLength(2)

      await server.close()
    })

    it('produces correct ClassMethodInfo for each tool', async () => {
      const dir = makeTmpDir()
      tmpDirs.push(dir)
      const servers = await loadMcpServers(makeServerConfig(dir))
      const [server] = servers

      const echo = server.methods.find(m => m.name === 'echo')!
      expect(echo.description).toBe('Echo text back')
      expect(echo.signature).toBe('(args: { text: string }) => Promise<any>')

      const add = server.methods.find(m => m.name === 'add')!
      expect(add.description).toBe('Add two numbers')
      expect(add.signature).toBe('(args: { a: number; b: number }) => Promise<any>')

      await server.close()
    })

    it('inject() creates callable tool namespace', async () => {
      const dir = makeTmpDir()
      tmpDirs.push(dir)
      const servers = await loadMcpServers(makeServerConfig(dir))
      const [server] = servers

      const injected: Record<string, unknown> = {}
      server.inject((name, value) => { injected[name] = value })

      expect(typeof injected['TestTools']).toBe('object')
      const ns = injected['TestTools'] as Record<string, Function>
      expect(typeof ns.echo).toBe('function')
      expect(typeof ns.add).toBe('function')

      await server.close()
    })

    it('injected tools execute correctly', async () => {
      const dir = makeTmpDir()
      tmpDirs.push(dir)
      const servers = await loadMcpServers(makeServerConfig(dir))
      const [server] = servers

      const injected: Record<string, unknown> = {}
      server.inject((name, value) => { injected[name] = value })
      const ns = injected['TestTools'] as Record<string, Function>

      const echoResult = await ns.echo({ text: 'hello world' }) as any[]
      expect(echoResult[0].text).toBe('hello world')

      const addResult = await ns.add({ a: 3, b: 4 }) as any[]
      expect(addResult[0].text).toBe('7')

      await server.close()
    })

    it('handles multiple servers in one mcp.json', async () => {
      const dir = makeTmpDir()
      tmpDirs.push(dir)

      const serverPath = join(dir, 'server.mjs')
      writeFileSync(serverPath, TEST_SERVER_SCRIPT)

      writeFileSync(join(dir, 'mcp.json'), JSON.stringify({
        mcpServers: {
          alpha: { command: 'node', args: [serverPath] },
          beta: { command: 'node', args: [serverPath] },
        },
      }))

      const servers = await loadMcpServers(join(dir, 'mcp.json'))
      expect(servers).toHaveLength(2)
      expect(servers.map(s => s.name).sort()).toEqual(['Alpha', 'Beta'])

      await Promise.all(servers.map(s => s.close()))
    })
  })

  describe('PascalCase conversion', () => {
    // Test via loadMcpServers with different key formats
    it('converts kebab-case key to PascalCase name', async () => {
      const dir = makeTmpDir()
      tmpDirs.push(dir)
      const serverPath = join(dir, 'server.mjs')
      writeFileSync(serverPath, TEST_SERVER_SCRIPT)
      writeFileSync(join(dir, 'mcp.json'), JSON.stringify({
        mcpServers: { 'my-file-system': { command: 'node', args: [serverPath] } },
      }))
      const [server] = await loadMcpServers(join(dir, 'mcp.json'))
      expect(server.name).toBe('MyFileSystem')
      await server.close()
    })

    it('converts snake_case key to PascalCase name', async () => {
      const dir = makeTmpDir()
      tmpDirs.push(dir)
      const serverPath = join(dir, 'server.mjs')
      writeFileSync(serverPath, TEST_SERVER_SCRIPT)
      writeFileSync(join(dir, 'mcp.json'), JSON.stringify({
        mcpServers: { web_search: { command: 'node', args: [serverPath] } },
      }))
      const [server] = await loadMcpServers(join(dir, 'mcp.json'))
      expect(server.name).toBe('WebSearch')
      await server.close()
    })
  })
})
