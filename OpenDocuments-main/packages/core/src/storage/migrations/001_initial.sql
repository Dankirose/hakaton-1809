CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    mode TEXT DEFAULT 'personal',
    settings TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE workspace_members (
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    api_key TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE connectors (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    sync_interval_seconds INTEGER DEFAULT 300,
    last_synced_at TEXT,
    status TEXT DEFAULT 'active',
    error_message TEXT,
    deleted_at TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    connector_id TEXT REFERENCES connectors(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_path TEXT NOT NULL,
    file_type TEXT,
    file_size_bytes INTEGER,
    chunk_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    content_hash TEXT,
    parser_used TEXT,
    parse_duration_ms INTEGER,
    deleted_at TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    indexed_at TEXT
);

CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    UNIQUE(workspace_id, name)
);

CREATE TABLE document_tags (
    document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, tag_id)
);

CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id TEXT,
    title TEXT,
    shared INTEGER DEFAULT 0,
    share_token TEXT UNIQUE,
    deleted_at TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    sources TEXT,
    profile_used TEXT,
    confidence_score REAL,
    response_time_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE query_logs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    intent TEXT,
    profile TEXT,
    retrieved_chunk_ids TEXT,
    reranked_chunk_ids TEXT,
    retrieval_score_avg REAL,
    rerank_score_avg REAL,
    confidence_score REAL,
    response_time_ms INTEGER,
    web_search_used INTEGER DEFAULT 0,
    feedback TEXT,
    route TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    user_id TEXT,
    event_type TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE plugins (
    name TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    version TEXT NOT NULL,
    config TEXT DEFAULT '{}',
    permissions TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active',
    installed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_documents_workspace ON documents(workspace_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_source_type ON documents(source_type);
CREATE INDEX idx_documents_content_hash ON documents(content_hash);
CREATE INDEX idx_documents_deleted ON documents(deleted_at);
CREATE INDEX idx_connectors_workspace ON connectors(workspace_id);
CREATE INDEX idx_conversations_workspace ON conversations(workspace_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_query_logs_workspace ON query_logs(workspace_id, created_at);
CREATE INDEX idx_audit_logs_event ON audit_logs(event_type, created_at);
