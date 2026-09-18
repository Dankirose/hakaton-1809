import type { DB } from '../storage/db.js'

export interface AlertRule {
  name: string
  condition: { event: string; threshold: number; windowMinutes: number }
  action: 'notify' | 'block-ip' | 'throttle'
}

export interface Alert {
  rule: string
  message: string
  triggeredAt: string
  details: Record<string, unknown>
}

export class SecurityAlertManager {
  private static MAX_ALERTS = 1000
  private rules: AlertRule[] = []
  private alerts: Alert[] = []
  private eventCounts = new Map<string, { count: number; timestamps: number[] }>()

  constructor(private db: DB, rules?: AlertRule[]) {
    this.rules = rules || [
      { name: 'brute-force', condition: { event: 'auth:failed', threshold: 10, windowMinutes: 5 }, action: 'block-ip' },
      { name: 'unusual-export', condition: { event: 'document:exported', threshold: 50, windowMinutes: 60 }, action: 'notify' },
      { name: 'api-key-abuse', condition: { event: 'rate:exceeded', threshold: 5, windowMinutes: 10 }, action: 'throttle' },
    ]
  }

  checkEvent(eventType: string, details?: Record<string, unknown>): Alert | null {
    const now = Date.now()

    // Track in-memory so alerts work even when audit logging is disabled
    let entry = this.eventCounts.get(eventType)
    if (!entry) { entry = { count: 0, timestamps: [] }; this.eventCounts.set(eventType, entry) }
    entry.timestamps.push(now)

    for (const rule of this.rules) {
      if (rule.condition.event !== eventType) continue

      const windowMs = rule.condition.windowMinutes * 60000
      // Filter to recent timestamps within the rule's window
      entry.timestamps = entry.timestamps.filter(t => now - t < windowMs)

      if (entry.timestamps.length >= rule.condition.threshold) {
        const alert: Alert = {
          rule: rule.name,
          message: `${rule.name}: ${eventType} threshold (${rule.condition.threshold}) exceeded in ${rule.condition.windowMinutes}m window`,
          triggeredAt: new Date().toISOString(),
          details: details || {},
        }
        this.alerts.push(alert)
        if (this.alerts.length > SecurityAlertManager.MAX_ALERTS) {
          this.alerts = this.alerts.slice(-SecurityAlertManager.MAX_ALERTS)
        }
        return alert
      }
    }
    return null
  }

  getRecentAlerts(limit = 50): Alert[] {
    return this.alerts.slice(-limit)
  }

  clearAlerts(): void {
    this.alerts = []
  }
}
