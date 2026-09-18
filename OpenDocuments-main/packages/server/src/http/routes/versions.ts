import { Hono } from 'hono'
import type { AppContext } from '../../bootstrap.js'
import { getWorkspaceServices } from '../workspace.js'
import { requireScope } from '../middleware/auth.js'

/**
 * Document version history endpoints.
 *
 * Every successful (re)index of a document appends a version with a chunk
 * snapshot, which lets the UI answer "what is the current revision and what
 * changed since the previous one". Reads are scoped to the caller's workspace.
 */
export function versionRoutes(ctx: AppContext) {
  const app = new Hono()

  app.get('/api/v1/documents/:id/versions', requireScope('document:read'), (c) => {
    const { store, versionManager } = getWorkspaceServices(c, ctx)
    const id = c.req.param('id')
    if (!id) return c.json({ error: 'Document id required' }, 400)
    if (!store.getDocument(id)) return c.json({ error: 'Document not found' }, 404)

    const versions = versionManager.listVersions(id)
    return c.json({ versions, activeVersion: versionManager.getActiveVersion(id) ?? null })
  })

  // Registered before the `:version` route so "diff" is not parsed as a version.
  app.get('/api/v1/documents/:id/versions/diff', requireScope('document:read'), (c) => {
    const { store, versionManager } = getWorkspaceServices(c, ctx)
    const id = c.req.param('id')
    if (!id) return c.json({ error: 'Document id required' }, 400)
    if (!store.getDocument(id)) return c.json({ error: 'Document not found' }, 404)

    const toParam = c.req.query('to')
    const fromParam = c.req.query('from')
    const to = toParam ? Number.parseInt(toParam, 10) : versionManager.getLatestVersion(id)?.version
    if (!to || Number.isNaN(to)) return c.json({ error: 'No version to compare' }, 400)
    const from = fromParam ? Number.parseInt(fromParam, 10) : to - 1
    if (Number.isNaN(from) || from < 1) {
      return c.json({ error: 'No previous version to compare' }, 400)
    }

    const diff = versionManager.diffVersions(id, from, to)
    if (!diff) return c.json({ error: 'Version not found' }, 404)
    return c.json(diff)
  })

  app.get('/api/v1/documents/:id/versions/:version', requireScope('document:read'), (c) => {
    const { store, versionManager } = getWorkspaceServices(c, ctx)
    const id = c.req.param('id')
    const versionParam = c.req.param('version')
    if (!id) return c.json({ error: 'Document id required' }, 400)
    if (!versionParam) return c.json({ error: 'Invalid version' }, 400)
    const version = Number.parseInt(versionParam, 10)
    if (Number.isNaN(version)) return c.json({ error: 'Invalid version' }, 400)
    if (!store.getDocument(id)) return c.json({ error: 'Document not found' }, 404)

    const record = versionManager.getVersion(id, version)
    if (!record) return c.json({ error: 'Version not found' }, 404)
    return c.json(record)
  })

  return app
}
