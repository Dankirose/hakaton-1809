import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WorkspaceManager } from '../../src/workspace/manager.js'
import { createSQLiteDB } from '../../src/storage/sqlite.js'
import { runMigrations } from '../../src/storage/migrations/runner.js'
import type { DB } from '../../src/storage/db.js'

describe('WorkspaceManager', () => {
  let db: DB
  let manager: WorkspaceManager

  beforeEach(() => {
    db = createSQLiteDB(':memory:')
    runMigrations(db)
    manager = new WorkspaceManager(db)
  })

  afterEach(() => { db.close() })

  it('creates a workspace', () => {
    const ws = manager.create('engineering', 'team')
    expect(ws.name).toBe('engineering')
    expect(ws.mode).toBe('team')
    expect(ws.id).toBeDefined()
  })

  it('rejects duplicate workspace names', () => {
    manager.create('engineering', 'personal')
    expect(() => manager.create('engineering', 'personal')).toThrow('already exists')
  })

  it('lists all workspaces', () => {
    manager.create('eng', 'team')
    manager.create('hr', 'team')
    const list = manager.list()
    expect(list).toHaveLength(2)
    expect(list.map(w => w.name)).toEqual(['eng', 'hr'])
  })

  it('gets a workspace by name', () => {
    manager.create('eng', 'personal')
    const ws = manager.getByName('eng')
    expect(ws).toBeDefined()
    expect(ws!.name).toBe('eng')
  })

  it('returns undefined for nonexistent workspace', () => {
    expect(manager.getByName('nope')).toBeUndefined()
  })

  it('deletes a workspace', () => {
    const ws = manager.create('temp', 'personal')
    manager.delete(ws.id)
    expect(manager.getByName('temp')).toBeUndefined()
  })

  it('ensures default workspace exists', () => {
    manager.ensureDefault()
    const ws = manager.getByName('default')
    expect(ws).toBeDefined()
    expect(ws!.mode).toBe('personal')
  })

  it('does not duplicate default workspace', () => {
    manager.ensureDefault()
    manager.ensureDefault()
    const list = manager.list()
    expect(list.filter(w => w.name === 'default')).toHaveLength(1)
  })
})
