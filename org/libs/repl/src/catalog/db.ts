import type { CatalogModule } from './types'

async function getSqlite(): Promise<any> {
  try {
    return (await import('better-sqlite3')).default
  } catch {
    throw new Error('better-sqlite3 is required for database operations. Install with: pnpm add better-sqlite3')
  }
}

let dbInstance: any = null
let dbPath = './repl.db'

export function setDbPath(path: string): void {
  dbPath = path
  dbInstance = null
}

async function getDb(): Promise<any> {
  if (!dbInstance) {
    const Database = await getSqlite()
    dbInstance = new Database(dbPath)
  }
  return dbInstance
}

const dbModule: CatalogModule = {
  id: 'db',
  description: 'Database queries (SQLite)',
  functions: [
    {
      name: 'dbQuery',
      description: 'Run SELECT query, return rows',
      signature: '(sql: string, params?: any[]) => Promise<any[]>',
      fn: async (sql: unknown, params?: unknown) => {
        const db = await getDb()
        const stmt = db.prepare(sql as string)
        return stmt.all(...((params as unknown[]) ?? []))
      },
    },
    {
      name: 'dbExecute',
      description: 'Run INSERT/UPDATE/DELETE',
      signature: '(sql: string, params?: any[]) => Promise<{ changes: number }>',
      fn: async (sql: unknown, params?: unknown) => {
        const db = await getDb()
        const stmt = db.prepare(sql as string)
        const result = stmt.run(...((params as unknown[]) ?? []))
        return { changes: result.changes }
      },
    },
    {
      name: 'dbSchema',
      description: 'Get database schema',
      signature: '() => Promise<{ tables: Array<{ name: string, columns: any[] }> }>',
      fn: async () => {
        const db = await getDb()
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
        const result = []
        for (const table of tables) {
          const columns = db.prepare(`PRAGMA table_info(${table.name})`).all()
          result.push({ name: table.name, columns })
        }
        return { tables: result }
      },
    },
  ],
}

export default dbModule
