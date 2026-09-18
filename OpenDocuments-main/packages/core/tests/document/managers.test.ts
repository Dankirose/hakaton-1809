import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DocumentVersionManager } from '../../src/document/version-manager.js'
import { TagManager } from '../../src/document/tag-manager.js'
import { CollectionManager } from '../../src/document/collection-manager.js'
import { ChunkRelationManager } from '../../src/document/chunk-relations.js'
import { createSQLiteDB } from '../../src/storage/sqlite.js'
import { runMigrations } from '../../src/storage/migrations/runner.js'
import type { DB } from '../../src/storage/db.js'

describe('Document Managers', () => {
  let db: DB

  beforeEach(() => {
    db = createSQLiteDB(':memory:')
    runMigrations(db)
    db.run("INSERT INTO workspaces (id, name) VALUES ('ws-1', 'default')")
    db.run("INSERT INTO workspaces (id, name) VALUES ('ws-2', 'secondary')")
    db.run("INSERT INTO documents (id, workspace_id, title, source_type, source_path) VALUES ('doc-1', 'ws-1', 'test.md', 'local', '/test.md')")
    db.run("INSERT INTO documents (id, workspace_id, title, source_type, source_path) VALUES ('doc-2', 'ws-2', 'other.md', 'local', '/other.md')")
  })

  afterEach(() => db.close())

  describe('DocumentVersionManager', () => {
    it('records and lists versions with the newest active', () => {
      const mgr = new DocumentVersionManager(db, 'ws-1')
      mgr.recordVersion('doc-1', 'hash1', 10)
      mgr.recordVersion('doc-1', 'hash2', 12)
      const versions = mgr.listVersions('doc-1')
      expect(versions).toHaveLength(2)
      expect(versions[0].version).toBe(2)
      expect(versions[1].version).toBe(1)
      expect(mgr.getActiveVersion('doc-1')?.version).toBe(2)
    })

    it('gets specific and latest versions', () => {
      const mgr = new DocumentVersionManager(db, 'ws-1')
      mgr.recordVersion('doc-1', 'hash1', 10)
      mgr.recordVersion('doc-1', 'hash2', 12)
      expect(mgr.getVersion('doc-1', 1)?.contentHash).toBe('hash1')
      expect(mgr.getLatestVersion('doc-1')?.version).toBe(2)
    })

    it('computes added, modified and removed chunks between versions', () => {
      const mgr = new DocumentVersionManager(db, 'ws-1')
      mgr.recordVersion('doc-1', 'hash1', 3, {
        chunks: [
          { position: 0, content: 'alpha', headingHierarchy: ['A'] },
          { position: 1, content: 'beta', headingHierarchy: ['A'] },
          { position: 2, content: 'gamma', headingHierarchy: ['B'] },
        ],
      })
      const second = mgr.recordVersion('doc-1', 'hash2', 3, {
        chunks: [
          { position: 0, content: 'alpha', headingHierarchy: ['A'] },
          { position: 1, content: 'beta changed', headingHierarchy: ['A'] },
          { position: 2, content: 'delta', headingHierarchy: ['B'] },
        ],
      })

      expect(second?.changes).toMatchObject({ added: 1, modified: 1, removed: 1, unchanged: 1 })

      const diff = mgr.diffVersions('doc-1', 1, 2)
      expect(diff).toBeDefined()
      expect(diff?.added.map((c) => c.content)).toEqual(['delta'])
      expect(diff?.removed.map((c) => c.content)).toEqual(['gamma'])
      expect(diff?.modified[0].before.content).toBe('beta')
      expect(diff?.modified[0].after.content).toBe('beta changed')
    })

    it('keeps chunk snapshots per version', () => {
      const mgr = new DocumentVersionManager(db, 'ws-1')
      mgr.recordVersion('doc-1', 'hash1', 1, { chunks: [{ position: 0, content: 'alpha', headingHierarchy: ['A'] }] })
      mgr.recordVersion('doc-1', 'hash2', 1, { chunks: [{ position: 0, content: 'beta', headingHierarchy: ['A'] }] })
      expect(mgr.getVersionChunks('doc-1', 1)[0].content).toBe('alpha')
      expect(mgr.getVersionChunks('doc-1', 2)[0].content).toBe('beta')
    })

    it('isolates version history by workspace', () => {
      const ws1 = new DocumentVersionManager(db, 'ws-1')
      const ws2 = new DocumentVersionManager(db, 'ws-2')
      ws1.recordVersion('doc-1', 'hash1', 1)
      expect(ws2.listVersions('doc-1')).toHaveLength(0)
      expect(ws2.recordVersion('doc-2', 'hash2', 1)).toBeDefined()
      expect(ws1.listVersions('doc-2')).toHaveLength(0)
    })

    it('compares two documents by their active versions', () => {
      const mgr = new DocumentVersionManager(db, 'ws-1')
      db.run("INSERT INTO documents (id, workspace_id, title, source_type, source_path) VALUES ('doc-3', 'ws-1', 'three.md', 'local', '/three.md')")
      mgr.recordVersion('doc-1', 'hash1', 3, {
        chunks: [
          { position: 0, content: 'alpha beta' },
          { position: 1, content: 'gamma delta' },
          { position: 2, content: 'epsilon' },
        ],
      })
      mgr.recordVersion('doc-3', 'hash2', 2, {
        chunks: [
          { position: 0, content: 'alpha beta' },
          { position: 1, content: 'gamma delta epsilon' },
        ],
      })

      const comparison = mgr.compareDocuments('doc-1', 'doc-3')
      expect(comparison).toBeDefined()
      expect(comparison?.left.id).toBe('doc-1')
      expect(comparison?.right.id).toBe('doc-3')
      expect(comparison?.changes.unchanged).toBe(1)
      expect(comparison?.changes.modified).toBe(1)
      expect(comparison?.changes.removed).toBe(1)
      expect(comparison?.similarity).toBeGreaterThan(0)
    })

    it('refuses to compare a document with itself', () => {
      const mgr = new DocumentVersionManager(db, 'ws-1')
      mgr.recordVersion('doc-1', 'hash1', 1, { chunks: [{ position: 0, content: 'alpha' }] })
      expect(mgr.compareDocuments('doc-1', 'doc-1')).toBeUndefined()
    })
  })

  describe('TagManager', () => {
    it('creates and lists tags', () => {
      const mgr = new TagManager(db, 'ws-1')
      mgr.create('backend', '#3b82f6')
      mgr.create('frontend')
      expect(mgr.list()).toHaveLength(2)
    })

    it('tags and untags documents', () => {
      const mgr = new TagManager(db, 'ws-1')
      const tag = mgr.create('important')
      mgr.tagDocument('doc-1', tag.id)
      expect(mgr.getDocumentTags('doc-1')).toHaveLength(1)
      mgr.untagDocument('doc-1', tag.id)
      expect(mgr.getDocumentTags('doc-1')).toHaveLength(0)
    })

    it('deletes tags', () => {
      const mgr = new TagManager(db, 'ws-1')
      const tag = mgr.create('temp')
      mgr.delete(tag.id)
      expect(mgr.list()).toHaveLength(0)
    })

    it('does not mutate tags or documents from another workspace', () => {
      const ws1 = new TagManager(db, 'ws-1')
      const ws2 = new TagManager(db, 'ws-2')
      const foreignTag = ws2.create('foreign')

      ws1.tagDocument('doc-1', foreignTag.id)
      ws1.tagDocument('doc-2', foreignTag.id)
      expect(ws2.getDocumentTags('doc-2')).toHaveLength(0)

      ws1.delete(foreignTag.id)
      expect(ws2.list()).toHaveLength(1)
    })
  })

  describe('CollectionManager', () => {
    it('creates and lists collections', () => {
      const mgr = new CollectionManager(db, 'ws-1')
      mgr.create('Backend Docs', 'All backend documentation')
      expect(mgr.list()).toHaveLength(1)
    })

    it('adds and removes documents', () => {
      const mgr = new CollectionManager(db, 'ws-1')
      const col = mgr.create('Test Collection')
      mgr.addDocument(col.id, 'doc-1')
      expect(mgr.getDocuments(col.id)).toEqual(['doc-1'])
      mgr.removeDocument(col.id, 'doc-1')
      expect(mgr.getDocuments(col.id)).toEqual([])
    })

    it('supports auto-rules', () => {
      const mgr = new CollectionManager(db, 'ws-1')
      const col = mgr.create('Auto', undefined, { source_type: 'github', tags: ['backend'] })
      const retrieved = mgr.list()
      expect(retrieved[0].autoRules).toEqual({ source_type: 'github', tags: ['backend'] })
    })

    it('does not mutate collections or documents from another workspace', () => {
      const ws1 = new CollectionManager(db, 'ws-1')
      const ws2 = new CollectionManager(db, 'ws-2')
      const foreignCollection = ws2.create('Foreign')

      ws1.addDocument(foreignCollection.id, 'doc-1')
      ws1.addDocument(foreignCollection.id, 'doc-2')
      expect(ws2.getDocuments(foreignCollection.id)).toEqual([])

      ws1.delete(foreignCollection.id)
      expect(ws2.list()).toHaveLength(1)
    })
  })

  describe('ChunkRelationManager', () => {
    it('adds and retrieves relations', () => {
      const mgr = new ChunkRelationManager(db)
      mgr.addRelation('doc-1_chunk_0', 'doc-1_chunk_1', 'next')
      mgr.addRelation('doc-1_chunk_0', 'doc-1_chunk_2', 'references')
      const related = mgr.getRelated('doc-1_chunk_0')
      expect(related).toHaveLength(2)
    })

    it('filters by relation type', () => {
      const mgr = new ChunkRelationManager(db)
      mgr.addRelation('doc-1_chunk_0', 'doc-1_chunk_1', 'next')
      mgr.addRelation('doc-1_chunk_0', 'doc-1_chunk_2', 'references')
      expect(mgr.getRelated('doc-1_chunk_0', 'next')).toHaveLength(1)
    })

    it('removes relations for document', () => {
      const mgr = new ChunkRelationManager(db)
      mgr.addRelation('doc-1_chunk_0', 'doc-1_chunk_1', 'next')
      mgr.removeRelationsForDocument('doc-1')
      expect(mgr.getRelated('doc-1_chunk_0')).toHaveLength(0)
    })
  })
})
