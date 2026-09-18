// packages/core/src/storage/sqlite.ts
import Database from 'better-sqlite3'
import type { DB, Row } from './db.js'

export function createSQLiteDB(path: string): DB {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  return {
    run(sql: string, params: unknown[] = []): void {
      db.prepare(sql).run(...params)
    },
    get<T extends Row = Row>(sql: string, params: unknown[] = []): T | undefined {
      return db.prepare(sql).get(...params) as T | undefined
    },
    all<T extends Row = Row>(sql: string, params: unknown[] = []): T[] {
      return db.prepare(sql).all(...params) as T[]
    },
    exec(sql: string): void {
      db.exec(sql)
    },
    close(): void {
      db.close()
    },
    transaction<T>(fn: () => T): T {
      return db.transaction(fn)()
    },
  }
}
