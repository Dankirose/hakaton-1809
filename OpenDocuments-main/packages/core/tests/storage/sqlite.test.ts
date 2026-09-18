// packages/core/tests/storage/sqlite.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { createSQLiteDB } from '../../src/storage/sqlite.js'
import type { DB } from '../../src/storage/db.js'

describe('SQLite DB', () => {
  let db: DB

  afterEach(() => { db?.close() })

  it('creates an in-memory database', () => {
    db = createSQLiteDB(':memory:')
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')
    db.run('INSERT INTO test (id, name) VALUES (?, ?)', [1, 'hello'])
    const row = db.get<{ id: number; name: string }>('SELECT * FROM test WHERE id = ?', [1])
    expect(row).toEqual({ id: 1, name: 'hello' })
  })

  it('returns all rows', () => {
    db = createSQLiteDB(':memory:')
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')
    db.run('INSERT INTO test (id, name) VALUES (?, ?)', [1, 'a'])
    db.run('INSERT INTO test (id, name) VALUES (?, ?)', [2, 'b'])
    const rows = db.all<{ id: number; name: string }>('SELECT * FROM test ORDER BY id')
    expect(rows).toEqual([{ id: 1, name: 'a' }, { id: 2, name: 'b' }])
  })

  it('supports transactions', () => {
    db = createSQLiteDB(':memory:')
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')
    db.transaction(() => {
      db.run('INSERT INTO test (id, name) VALUES (?, ?)', [1, 'a'])
      db.run('INSERT INTO test (id, name) VALUES (?, ?)', [2, 'b'])
    })
    const rows = db.all('SELECT * FROM test')
    expect(rows).toHaveLength(2)
  })
})
