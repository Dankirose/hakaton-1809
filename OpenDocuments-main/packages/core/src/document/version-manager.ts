import { randomUUID } from 'node:crypto'
import type { DB, Row } from '../storage/db.js'
import { sha256 } from '../utils/hash.js'

/**
 * Summary of what changed between two consecutive versions. Stored on the
 * version row so listing does not have to load every chunk snapshot.
 */
export interface VersionChanges {
  fromVersion: number | null
  added: number
  removed: number
  modified: number
  unchanged: number
  /** Short previews (first 160 chars) of added chunks, newest version first. */
  addedChunks: string[]
  /** Short previews (first 160 chars) of removed chunks, oldest version first. */
  removedChunks: string[]
}

/** A single chunk captured at the moment a version was recorded. */
export interface VersionChunk {
  position: number
  content: string
  headingHierarchy: string[]
  contentHash: string
}

export interface DocumentVersion {
  id: string
  documentId: string
  version: number
  contentHash: string
  chunkCount: number | null
  title: string | null
  sourceVersion: string | null
  isActive: boolean
  changes: VersionChanges | null
  createdAt: string
}

/** Chunk supplied by the ingest pipeline when a version is recorded. */
export interface VersionChunkInput {
  position: number
  content: string
  headingHierarchy?: string[]
}

export interface RecordVersionOptions {
  title?: string
  sourceVersion?: string
  /** Chunk snapshot used to compute a diff against the previous version. */
  chunks?: VersionChunkInput[]
}

/** Full structural diff between two versions, including chunk content. */
export interface VersionDiff {
  documentId: string
  fromVersion: number
  toVersion: number
  changes: VersionChanges
  added: VersionChunk[]
  removed: VersionChunk[]
  modified: Array<{ before: VersionChunk; after: VersionChunk }>
}

const PREVIEW_LENGTH = 160
/** Above this word-overlap score an unmatched chunk is treated as an edit. */
const SIMILARITY_THRESHOLD = 0.5
/** LCS guard: (prev × next) cells above this fall back to a linear matcher. */
const LCS_CELL_LIMIT = 4_000_000

interface VersionRow extends Row {
  id: string
  document_id: string
  version: number
  content_hash: string
  chunk_count: number | null
  changes: string | null
  title: string | null
  source_version: string | null
  is_active: number
  created_at: string
}

interface ChunkRow extends Row {
  position: number
  content: string
  heading_hierarchy: string | null
  content_hash: string
}

function toVersion(row: VersionRow): DocumentVersion {
  return {
    id: row.id,
    documentId: row.document_id,
    version: row.version,
    contentHash: row.content_hash,
    chunkCount: row.chunk_count,
    title: row.title ?? null,
    sourceVersion: row.source_version ?? null,
    isActive: row.is_active === 1,
    changes: row.changes ? (JSON.parse(row.changes) as VersionChanges) : null,
    createdAt: row.created_at,
  }
}

function toChunk(row: ChunkRow): VersionChunk {
  let headingHierarchy: string[] = []
  if (row.heading_hierarchy) {
    try {
      const parsed: unknown = JSON.parse(row.heading_hierarchy)
      if (Array.isArray(parsed)) headingHierarchy = parsed.filter((h): h is string => typeof h === 'string')
    } catch {
      headingHierarchy = []
    }
  }
  return {
    position: row.position,
    content: row.content,
    headingHierarchy,
    contentHash: row.content_hash,
  }
}

function preview(content: string): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH)}…` : flat
}

function hashOf(content: string): string {
  return sha256(content)
}

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0)
  return new Set(tokens)
}

/** Jaccard similarity over word tokens; 1 for identical text, 0 for disjoint. */
function similarity(a: string, b: string): number {
  if (a === b) return 1
  const setA = tokenize(a)
  const setB = tokenize(b)
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) intersection++
  }
  return intersection / (setA.size + setB.size - intersection)
}

/**
 * Records and reads the version history of documents in a single workspace.
 *
 * Every successful (re)index appends a new, monotonically increasing version.
 * The newest version is marked as active; older versions keep a chunk snapshot
 * so diffs ("what changed since the previous revision") can be rendered.
 */
export class DocumentVersionManager {
  constructor(private db: DB, private workspaceId: string) {}

  private documentBelongsToWorkspace(documentId: string): boolean {
    const row = this.db.get<Row>(
      'SELECT id FROM documents WHERE id = ? AND workspace_id = ?',
      [documentId, this.workspaceId]
    )
    return row !== undefined
  }

  /**
   * Append a version for a document. Returns `undefined` when the document is
   * unknown or belongs to another workspace.
   */
  recordVersion(
    documentId: string,
    contentHash: string,
    chunkCount: number,
    options: RecordVersionOptions = {}
  ): DocumentVersion | undefined {
    if (!this.documentBelongsToWorkspace(documentId)) return undefined

    const currentMax = this.db.get<Row>(
      'SELECT MAX(version) AS maxV FROM document_versions WHERE document_id = ?',
      [documentId]
    )
    const previousVersion = typeof currentMax?.maxV === 'number' ? currentMax.maxV : 0
    const version = previousVersion + 1
    const id = randomUUID()
    const now = new Date().toISOString()

    const nextChunks: VersionChunk[] = (options.chunks ?? []).map((chunk) => ({
      position: chunk.position,
      content: chunk.content,
      headingHierarchy: chunk.headingHierarchy ?? [],
      contentHash: hashOf(chunk.content),
    }))

    let changes: VersionChanges | null = null
    if (nextChunks.length > 0 && previousVersion > 0) {
      const previous = this.getVersion(documentId, previousVersion)
      if (previous) {
        const previousChunks = this.getVersionChunks(documentId, previousVersion)
        changes = this.summarizeDiff(previousVersion, previousChunks, nextChunks)
      }
    }

    this.db.transaction(() => {
      this.db.run('UPDATE document_versions SET is_active = 0 WHERE document_id = ?', [documentId])
      this.db.run(
        `INSERT INTO document_versions
           (id, document_id, version, content_hash, chunk_count, changes, title, source_version, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          id,
          documentId,
          version,
          contentHash,
          chunkCount,
          changes ? JSON.stringify(changes) : null,
          options.title ?? null,
          options.sourceVersion ?? null,
          now,
        ]
      )
      for (const chunk of nextChunks) {
        this.db.run(
          `INSERT OR REPLACE INTO document_version_chunks
             (version_id, position, content, heading_hierarchy, content_hash)
           VALUES (?, ?, ?, ?, ?)`,
          [id, chunk.position, chunk.content, JSON.stringify(chunk.headingHierarchy), chunk.contentHash]
        )
      }
    })

    return {
      id,
      documentId,
      version,
      contentHash,
      chunkCount,
      title: options.title ?? null,
      sourceVersion: options.sourceVersion ?? null,
      isActive: true,
      changes,
      createdAt: now,
    }
  }

  listVersions(documentId: string): DocumentVersion[] {
    return this.db.all<VersionRow>(
      `SELECT v.* FROM document_versions v
       JOIN documents d ON d.id = v.document_id
       WHERE v.document_id = ? AND d.workspace_id = ?
       ORDER BY v.version DESC`,
      [documentId, this.workspaceId]
    ).map(toVersion)
  }

  getVersion(documentId: string, version: number): DocumentVersion | undefined {
    const row = this.db.get<VersionRow>(
      `SELECT v.* FROM document_versions v
       JOIN documents d ON d.id = v.document_id
       WHERE v.document_id = ? AND v.version = ? AND d.workspace_id = ?`,
      [documentId, version, this.workspaceId]
    )
    return row ? toVersion(row) : undefined
  }

  /** Newest recorded version, or `undefined` when the document has none. */
  getLatestVersion(documentId: string): DocumentVersion | undefined {
    const row = this.db.get<VersionRow>(
      `SELECT v.* FROM document_versions v
       JOIN documents d ON d.id = v.document_id
       WHERE v.document_id = ? AND d.workspace_id = ?
       ORDER BY v.version DESC LIMIT 1`,
      [documentId, this.workspaceId]
    )
    return row ? toVersion(row) : undefined
  }

  /** Version flagged as active (falls back to the newest version). */
  getActiveVersion(documentId: string): DocumentVersion | undefined {
    const row = this.db.get<VersionRow>(
      `SELECT v.* FROM document_versions v
       JOIN documents d ON d.id = v.document_id
       WHERE v.document_id = ? AND v.is_active = 1 AND d.workspace_id = ?
       ORDER BY v.version DESC LIMIT 1`,
      [documentId, this.workspaceId]
    )
    return row ? toVersion(row) : this.getLatestVersion(documentId)
  }

  getVersionChunks(documentId: string, version: number): VersionChunk[] {
    const record = this.getVersion(documentId, version)
    if (!record) return []
    return this.db.all<ChunkRow>(
      `SELECT position, content, heading_hierarchy, content_hash
       FROM document_version_chunks
       WHERE version_id = ?
       ORDER BY position`,
      [record.id]
    ).map(toChunk)
  }

  /**
   * Structural diff between two versions. Returns `undefined` when either
   * version is unknown for this workspace.
   */
  diffVersions(documentId: string, fromVersion: number, toVersion: number): VersionDiff | undefined {
    const from = this.getVersion(documentId, fromVersion)
    const to = this.getVersion(documentId, toVersion)
    if (!from || !to) return undefined

    const fromChunks = this.getVersionChunks(documentId, fromVersion)
    const toChunks = this.getVersionChunks(documentId, toVersion)
    const { changes, added, removed, modified } = this.diffChunks(fromChunks, toChunks)

    return {
      documentId,
      fromVersion,
      toVersion,
      changes: { ...changes, fromVersion },
      added,
      removed,
      modified,
    }
  }

  private summarizeDiff(
    fromVersion: number,
    previousChunks: VersionChunk[],
    nextChunks: VersionChunk[]
  ): VersionChanges {
    const { added, removed, modified, unchanged } = this.diffChunks(previousChunks, nextChunks)
    return {
      fromVersion,
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      unchanged: unchanged.length,
      addedChunks: added.map((chunk) => preview(chunk.content)),
      removedChunks: removed.map((chunk) => preview(chunk.content)),
    }
  }

  /**
   * Diff chunk sets in two passes. Exact content matches are anchored with a
   * longest-common-subsequence over content hashes, so insertions and deletions
   * do not cascade into spurious edits. Inside the gaps between anchors, a
   * word-overlap similarity decides whether an unmatched pair is a rewrite
   * (modified) or a genuine add/remove.
   */
  private diffChunks(
    previousChunks: VersionChunk[],
    nextChunks: VersionChunk[]
  ): {
    added: VersionChunk[]
    removed: VersionChunk[]
    modified: Array<{ before: VersionChunk; after: VersionChunk }>
    unchanged: VersionChunk[]
    changes: Omit<VersionChanges, 'fromVersion'>
  } {
    const anchors = this.lcsMatches(
      previousChunks.map((chunk) => chunk.contentHash),
      nextChunks.map((chunk) => chunk.contentHash)
    )

    const added: VersionChunk[] = []
    const removed: VersionChunk[] = []
    const modified: Array<{ before: VersionChunk; after: VersionChunk }> = []
    const unchanged: VersionChunk[] = []

    // Gaps between consecutive anchors, plus the trailing gap.
    const gaps: Array<[number, number, number, number]> = []
    let previousCursor = 0
    let nextCursor = 0
    for (const [previousIndex, nextIndex] of anchors) {
      gaps.push([previousCursor, previousIndex, nextCursor, nextIndex])
      unchanged.push(nextChunks[nextIndex])
      previousCursor = previousIndex + 1
      nextCursor = nextIndex + 1
    }
    gaps.push([previousCursor, previousChunks.length, nextCursor, nextChunks.length])

    for (const [previousStart, previousEnd, nextStart, nextEnd] of gaps) {
      if (previousStart >= previousEnd && nextStart >= nextEnd) continue
      const gapPrevious = previousChunks.slice(previousStart, previousEnd)
      const gapNext = nextChunks.slice(nextStart, nextEnd)
      const claimed = new Set<number>()

      for (const next of gapNext) {
        let bestIndex = -1
        let bestScore = 0
        for (let index = 0; index < gapPrevious.length; index++) {
          if (claimed.has(index)) continue
          const score = similarity(gapPrevious[index].content, next.content)
          if (score > bestScore) {
            bestScore = score
            bestIndex = index
          }
        }
        if (bestIndex >= 0 && bestScore >= SIMILARITY_THRESHOLD) {
          claimed.add(bestIndex)
          modified.push({ before: gapPrevious[bestIndex], after: next })
        } else {
          added.push(next)
        }
      }

      for (let index = 0; index < gapPrevious.length; index++) {
        if (!claimed.has(index)) removed.push(gapPrevious[index])
      }
    }

    return {
      added,
      removed,
      modified,
      unchanged,
      changes: {
        added: added.length,
        removed: removed.length,
        modified: modified.length,
        unchanged: unchanged.length,
        addedChunks: added.map((chunk) => preview(chunk.content)),
        removedChunks: removed.map((chunk) => preview(chunk.content)),
      },
    }
  }

  /**
   * Longest-common-subsequence matches over content hashes. Falls back to a
   * linear greedy matcher for very large documents to bound memory use.
   */
  private lcsMatches(a: string[], b: string[]): Array<[number, number]> {
    const n = a.length
    const m = b.length
    if (n === 0 || m === 0) return []
    if (n * m > LCS_CELL_LIMIT) return this.greedyMatches(a, b)

    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }

    const matches: Array<[number, number]> = []
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        matches.push([i, j])
        i++
        j++
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        i++
      } else {
        j++
      }
    }
    return matches
  }

  private greedyMatches(a: string[], b: string[]): Array<[number, number]> {
    const positions = new Map<string, number[]>()
    b.forEach((hash, index) => {
      const bucket = positions.get(hash) ?? []
      bucket.push(index)
      positions.set(hash, bucket)
    })

    const matches: Array<[number, number]> = []
    let nextIndex = 0
    for (let i = 0; i < a.length; i++) {
      const candidates = positions.get(a[i])
      if (!candidates) continue
      const found = candidates.find((index) => index >= nextIndex)
      if (found === undefined) continue
      matches.push([i, found])
      nextIndex = found + 1
    }
    return matches
  }
}
