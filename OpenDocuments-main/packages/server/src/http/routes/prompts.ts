import { Hono } from 'hono'
import type { AppContext } from '../../bootstrap.js'
import { getWorkspaceServices } from '../workspace.js'
import { requireScope } from '../middleware/auth.js'

/**
 * Chat prompt CRUD endpoints. Prompts are workspace-scoped and applied as an
 * optional system prompt override when asking a question.
 */
export function promptRoutes(ctx: AppContext) {
  const app = new Hono()

  app.get('/api/v1/prompts', requireScope('ask'), (c) => {
    const { promptManager } = getWorkspaceServices(c, ctx)
    return c.json({ prompts: promptManager.list() })
  })

  app.post('/api/v1/prompts', requireScope('ask'), async (c) => {
    const { promptManager } = getWorkspaceServices(c, ctx)
    const body = await c.req.json<{ name?: string; description?: string; content?: string }>()
    const name = body.name?.trim()
    const content = body.content?.trim()
    if (!name) return c.json({ error: 'Prompt name is required' }, 400)
    if (!content) return c.json({ error: 'Prompt content is required' }, 400)
    return c.json(promptManager.create({ name, description: body.description?.trim() || undefined, content }), 201)
  })

  app.patch('/api/v1/prompts/:id', requireScope('ask'), async (c) => {
    const { promptManager } = getWorkspaceServices(c, ctx)
    const id = c.req.param('id')
    if (!id) return c.json({ error: 'Prompt id required' }, 400)
    const body = await c.req.json<{ name?: string; description?: string | null; content?: string }>()
    const updated = promptManager.update(id, {
      name: body.name?.trim() || undefined,
      description: body.description === null ? null : body.description?.trim(),
      content: body.content?.trim() || undefined,
    })
    if (!updated) return c.json({ error: 'Prompt not found' }, 404)
    return c.json(updated)
  })

  app.delete('/api/v1/prompts/:id', requireScope('ask'), (c) => {
    const { promptManager } = getWorkspaceServices(c, ctx)
    const id = c.req.param('id')
    if (!id) return c.json({ error: 'Prompt id required' }, 400)
    if (!promptManager.delete(id)) return c.json({ error: 'Prompt not found' }, 404)
    return c.json({ deleted: true })
  })

  return app
}
