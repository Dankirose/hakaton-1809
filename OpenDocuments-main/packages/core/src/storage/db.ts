// packages/core/src/storage/db.ts
export interface Row {
  [key: string]: unknown
}

export interface DB {
  run(sql: string, params?: unknown[]): void
  get<T extends Row = Row>(sql: string, params?: unknown[]): T | undefined
  all<T extends Row = Row>(sql: string, params?: unknown[]): T[]
  exec(sql: string): void
  close(): void
  transaction<T>(fn: () => T): T
}

export type DBFactory = (path: string) => DB
