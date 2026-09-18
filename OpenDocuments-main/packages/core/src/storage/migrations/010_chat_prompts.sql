-- Chat prompts: reusable, user-editable system prompts that can be applied to a
-- chat question. Each prompt is scoped to a workspace so team deployments keep
-- their instruction sets isolated.

CREATE TABLE IF NOT EXISTS chat_prompts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_prompts_workspace
  ON chat_prompts(workspace_id);
