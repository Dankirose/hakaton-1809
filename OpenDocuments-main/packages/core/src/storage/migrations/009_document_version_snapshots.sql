-- Document versioning: snapshot metadata and per-version chunk content.
-- `document_versions` already exists (migration 002); extend it so callers can
-- tell which version is current for a document and what the document looked
-- like at that point in time.

ALTER TABLE document_versions ADD COLUMN title TEXT;
ALTER TABLE document_versions ADD COLUMN source_version TEXT;
ALTER TABLE document_versions ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_doc_versions_active
  ON document_versions(document_id, is_active);

-- Chunk snapshot for each recorded version. Content is kept (in addition to a
-- content hash) so that a diff between two versions can be rendered without
-- re-fetching the original file. Rows cascade away with their version.
CREATE TABLE IF NOT EXISTS document_version_chunks (
    version_id TEXT NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    content TEXT NOT NULL,
    heading_hierarchy TEXT,
    content_hash TEXT NOT NULL,
    PRIMARY KEY (version_id, position)
);

CREATE INDEX IF NOT EXISTS idx_version_chunks_version
  ON document_version_chunks(version_id);
