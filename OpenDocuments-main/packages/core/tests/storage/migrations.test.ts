// packages/core/tests/storage/migrations.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { createSQLiteDB } from '../../src/storage/sqlite.js'
import { runMigrations } from '../../src/storage/migrations/runner.js'
import type { DB } from '../../src/storage/db.js'

describe('Migration Runner', () => {
  let db: DB

  afterEach(() => { db?.close() })

  it('applies initial migration and creates tables', () => {
    db = createSQLiteDB(':memory:')
    const result = runMigrations(db)
    expect(result.applied).toContain('001_initial.sql')
    expect(result.applied).toContain('002_add_versioning_collections.sql')

    const tables = db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )
    const tableNames = tables.map(t => t.name)
    expect(tableNames).toContain('workspaces')
    expect(tableNames).toContain('documents')
    expect(tableNames).toContain('connectors')
    expect(tableNames).toContain('conversations')
    expect(tableNames).toContain('messages')
    expect(tableNames).toContain('query_logs')
    expect(tableNames).toContain('audit_logs')
    expect(tableNames).toContain('plugins')
    expect(tableNames).toContain('schema_migrations')
    expect(tableNames).toContain('document_versions')
    expect(tableNames).toContain('collections')
    expect(tableNames).toContain('collection_documents')
    expect(tableNames).toContain('chunk_relations')
  })

  it('does not re-apply already applied migrations', () => {
    db = createSQLiteDB(':memory:')
    const first = runMigrations(db)
    expect(first.applied.length).toBeGreaterThan(0)
    const second = runMigrations(db)
    expect(second.applied).toEqual([])
  })
})
