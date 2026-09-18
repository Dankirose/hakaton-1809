-- Document versions
CREATE TABLE IF NOT EXISTS document_versions (
    id TEXT PRIMARY KEY,
    document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    chunk_count INTEGER,
    changes TEXT,
    snapshot_chunk_ids TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_doc_versions ON document_versions(document_id, version);

-- Collections
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    auto_rules TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collection_documents (
    collection_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
    document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    PRIMARY KEY (collection_id, document_id)
);

-- Chunk relationships
CREATE TABLE IF NOT EXISTS chunk_relations (
    source_chunk_id TEXT NOT NULL,
    target_chunk_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    PRIMARY KEY (source_chunk_id, target_chunk_id, relation_type)
);
