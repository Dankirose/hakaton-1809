import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SecurityAlertManager } from '../../src/security/alerts.js'
import { AuditLogger } from '../../src/security/audit.js'
import { createSQLiteDB } from '../../src/storage/sqlite.js'
import { runMigrations } from '../../src/storage/migrations/runner.js'
import type { DB } from '../../src/storage/db.js'

describe('SecurityAlertManager', () => {
  let db: DB
  let alertMgr: SecurityAlertManager
  let auditLogger: AuditLogger

  beforeEach(() => {
    db = createSQLiteDB(':memory:')
    runMigrations(db)
    auditLogger = new AuditLogger(db, { enabled: true })
    alertMgr = new SecurityAlertManager(db)
  })

  afterEach(() => db.close())

  it('does not trigger alert below threshold', () => {
    for (let i = 0; i < 5; i++) {
      auditLogger.log({ eventType: 'auth:failed' })
    }
    // Each checkEvent call also tracks the event in-memory
    let alert: ReturnType<SecurityAlertManager['checkEvent']> = null
    for (let i = 0; i < 5; i++) {
      alert = alertMgr.checkEvent('auth:failed')
    }
    expect(alert).toBeNull()
  })

  it('triggers alert when threshold exceeded', () => {
    let alert: ReturnType<SecurityAlertManager['checkEvent']> = null
    for (let i = 0; i < 11; i++) {
      auditLogger.log({ eventType: 'auth:failed' })
      alert = alertMgr.checkEvent('auth:failed')
    }
    expect(alert).not.toBeNull()
    expect(alert!.rule).toBe('brute-force')
  })

  it('tracks recent alerts', () => {
    for (let i = 0; i < 10; i++) {
      auditLogger.log({ eventType: 'auth:failed' })
      alertMgr.checkEvent('auth:failed')
    }
    expect(alertMgr.getRecentAlerts()).toHaveLength(1)
  })
})
