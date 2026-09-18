import { randomUUID } from 'node:crypto'
import type { DB, Row } from '../storage/db.js'

/** A reusable, user-editable system prompt for the chat. */
export interface ChatPrompt {
  id: string
  workspaceId: string
  name: string
  description: string | null
  content: string
  createdAt: string
  updatedAt: string
}

export interface CreatePromptInput {
  name: string
  description?: string
  content: string
}

export interface UpdatePromptInput {
  name?: string
  description?: string | null
  content?: string
}

interface PromptRow extends Row {
  id: string
  workspace_id: string
  name: string
  description: string | null
  content: string
  created_at: string
  updated_at: string
}

function toPrompt(row: PromptRow): ChatPrompt {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description ?? null,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Manages the reusable chat prompts of a single workspace. Prompts are stored
 * as plain text (typically markdown) and are applied verbatim as the system
 * prompt of a question, letting users steer the assistant without editing the
 * platform's built-in generation templates.
 */
export class ChatPromptManager {
  constructor(private db: DB, private workspaceId: string) {}

  create(input: CreatePromptInput): ChatPrompt {
    const id = randomUUID()
    const now = new Date().toISOString()
    this.db.run(
      `INSERT INTO chat_prompts (id, workspace_id, name, description, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, this.workspaceId, input.name, input.description ?? null, input.content, now, now]
    )
    return {
      id,
      workspaceId: this.workspaceId,
      name: input.name,
      description: input.description ?? null,
      content: input.content,
      createdAt: now,
      updatedAt: now,
    }
  }

  list(): ChatPrompt[] {
    return this.db.all<PromptRow>(
      'SELECT * FROM chat_prompts WHERE workspace_id = ? ORDER BY name',
      [this.workspaceId]
    ).map(toPrompt)
  }

  get(id: string): ChatPrompt | undefined {
    const row = this.db.get<PromptRow>(
      'SELECT * FROM chat_prompts WHERE id = ? AND workspace_id = ?',
      [id, this.workspaceId]
    )
    return row ? toPrompt(row) : undefined
  }

  update(id: string, input: UpdatePromptInput): ChatPrompt | undefined {
    const existing = this.get(id)
    if (!existing) return undefined

    const name = input.name ?? existing.name
    const description = input.description !== undefined ? input.description : existing.description
    const content = input.content ?? existing.content
    const now = new Date().toISOString()

    this.db.run(
      `UPDATE chat_prompts SET name = ?, description = ?, content = ?, updated_at = ?
       WHERE id = ? AND workspace_id = ?`,
      [name, description, content, now, id, this.workspaceId]
    )
    return this.get(id)
  }

  delete(id: string): boolean {
    const existing = this.get(id)
    if (!existing) return false
    this.db.run(
      'DELETE FROM chat_prompts WHERE id = ? AND workspace_id = ?',
      [id, this.workspaceId]
    )
    return true
  }
}
