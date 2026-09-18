import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { bootstrap, type AppContext } from '../../src/bootstrap.js'
import { createApp } from '../../src/http/app.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const stubModel = {
  provider: 'stub',
  llm: 'stub-llm',
  embedding: 'stub-embedding',
  apiKey: '',
  baseUrl: '',
  embeddingDimensions: 384,
} as any

describe('Prompt Routes', () => {
  let ctx: AppContext
  let app: ReturnType<typeof createApp>
  let tempDir: string

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'opendocuments-test-'))
    ctx = await bootstrap({ dataDir: tempDir, configOverrides: { model: stubModel } })
    app = createApp(ctx)
  })

  afterEach(async () => {
    await ctx.shutdown()
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('creates, lists, updates and deletes prompts', async () => {
    const create = await app.request('/api/v1/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Summary', description: 'Doc summary', content: '# Role\nSummarize.' }),
    })
    expect(create.status).toBe(201)
    const prompt = await create.json()

    const list = await app.request('/api/v1/prompts')
    expect(list.status).toBe(200)
    const listed = await list.json()
    expect(listed.prompts).toHaveLength(1)
    expect(listed.prompts[0]).toMatchObject({ id: prompt.id, name: 'Summary' })

    const update = await app.request(`/api/v1/prompts/${prompt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed', content: '# Role\nNew content.' }),
    })
    expect(update.status).toBe(200)
    const updated = await update.json()
    expect(updated.name).toBe('Renamed')
    expect(updated.content).toContain('New content')

    const del = await app.request(`/api/v1/prompts/${prompt.id}`, { method: 'DELETE' })
    expect(del.status).toBe(200)

    const afterDelete = await app.request('/api/v1/prompts')
    expect((await afterDelete.json()).prompts).toHaveLength(0)
  })

  it('rejects prompts without name or content', async () => {
    const noName = await app.request('/api/v1/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'x' }),
    })
    expect(noName.status).toBe(400)

    const noContent = await app.request('/api/v1/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'n' }),
    })
    expect(noContent.status).toBe(400)
  })

  it('returns 404 when mutating a missing prompt', async () => {
    const update = await app.request('/api/v1/prompts/missing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    })
    expect(update.status).toBe(404)

    const del = await app.request('/api/v1/prompts/missing', { method: 'DELETE' })
    expect(del.status).toBe(404)
  })
})
