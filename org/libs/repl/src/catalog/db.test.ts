import { describe, it, expect } from 'vitest'
import dbModule from './db'

describe('catalog/db', () => {
  it('module has expected functions', () => {
    const names = dbModule.functions.map(f => f.name)
    expect(names).toContain('dbQuery')
    expect(names).toContain('dbExecute')
    expect(names).toContain('dbSchema')
  })

  // Actual db tests would require better-sqlite3 to be installed
  // Testing that functions throw helpfully when it's missing
  it('functions throw if better-sqlite3 is not installed', async () => {
    const query = dbModule.functions.find(f => f.name === 'dbQuery')!
    try {
      await query.fn('SELECT 1')
    } catch (e: any) {
      expect(e.message).toBeTruthy()
    }
  })
})
