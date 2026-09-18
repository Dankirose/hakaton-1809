import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { bootstrap, type AppContext } from '../../src/bootstrap.js'
import { createApp } from '../../src/http/app.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('Document Version Routes', () => {
  let ctx: AppContext
  let app: ReturnType<typeof createApp>
  let tempDir: string

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'opendocuments-version-test-'))
    ctx = await bootstrap({
      dataDir: tempDir,
      configOverrides: {
        model: {
          provider: 'stub',
          llm: 'stub-llm',
          embedding: 'stub-embedding',
          apiKey: '',
          baseUrl: '',
          embeddingDimensions: 384,
        } as any,
      },
    })
    app = createApp(ctx)
  })
  afterEach(async () => { await ctx.shutdown(); rmSync(tempDir, { recursive: true, force: true }) })

  async function ingestTwice() {
    const { pipeline } = ctx.forWorkspace()
    const first = await pipeline.ingest({
      title: 'Policy',
      content: '# Policy\n\nAlpha rule applies to everyone.',
      sourceType: 'local',
      sourcePath: 'local:policy.md',
    })
    await pipeline.ingest(
      {
        title: 'Policy',
        content: '# Policy\n\nAlpha rule applies to everyone. Beta rule was added.',
        sourceType: 'local',
        sourcePath: 'local:policy.md',
      },
      { force: true },
    )
    return first.documentId
  }

  it('lists versions newest-first and marks the latest active', async () => {
    const documentId = await ingestTwice()
    const res = await app.request(`/api/v1/documents/${documentId}/versions`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.versions).toHaveLength(2)
    expect(body.versions[0].version).toBe(2)
    expect(body.activeVersion.version).toBe(2)
  })

  it('returns a specific version', async () => {
    const documentId = await ingestTwice()
    const res = await app.request(`/api/v1/documents/${documentId}/versions/1`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.version).toBe(1)
  })

  it('computes a diff against the previous version by default', async () => {
    const documentId = await ingestTwice()
    const res = await app.request(`/api/v1/documents/${documentId}/versions/diff`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fromVersion).toBe(1)
    expect(body.toVersion).toBe(2)
    const totalChanges = body.changes.added + body.changes.modified + body.changes.removed
    expect(totalChanges).toBeGreaterThan(0)
  })

  it('returns 404 for an unknown document', async () => {
    const res = await app.request('/api/v1/documents/does-not-exist/versions')
    expect(res.status).toBe(404)
  })

  it('returns 400 when there is no previous version to diff', async () => {
    const { pipeline } = ctx.forWorkspace()
    const only = await pipeline.ingest({
      title: 'Single',
      content: '# Single\n\nOnly one revision.',
      sourceType: 'local',
      sourcePath: 'local:single.md',
    })
    const res = await app.request(`/api/v1/documents/${only.documentId}/versions/diff`)
    expect(res.status).toBe(400)
  })

  it('compares two documents by their active versions', async () => {
    const { pipeline } = ctx.forWorkspace()
    const left = await pipeline.ingest({
      title: 'Left policy',
      content: '# Policy\n\nAlpha rule applies. Beta rule applies.',
      sourceType: 'local',
      sourcePath: 'local:left.md',
    })
    const right = await pipeline.ingest({
      title: 'Right policy',
      content: '# Policy\n\nAlpha rule applies. Gamma rule applies.',
      sourceType: 'local',
      sourcePath: 'local:right.md',
    })
    const res = await app.request(`/api/v1/documents/compare?left=${left.documentId}&right=${right.documentId}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.left.id).toBe(left.documentId)
    expect(body.right.id).toBe(right.documentId)
    expect(typeof body.similarity).toBe('number')
    const total = body.changes.added + body.changes.modified + body.changes.removed
    expect(total).toBeGreaterThan(0)
  })

  it('returns 400 when comparing a document with itself', async () => {
    const { pipeline } = ctx.forWorkspace()
    const doc = await pipeline.ingest({
      title: 'Same',
      content: '# Same\n\nOnly one.',
      sourceType: 'local',
      sourcePath: 'local:same.md',
    })
    const res = await app.request(`/api/v1/documents/compare?left=${doc.documentId}&right=${doc.documentId}`)
    expect(res.status).toBe(400)
  })

  it('returns 400 when the compare parameters are missing', async () => {
    const res = await app.request('/api/v1/documents/compare?left=only-one')
    expect(res.status).toBe(400)
  })
})
