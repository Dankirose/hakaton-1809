import { createHash } from 'node:crypto'

export interface RedactorConfig {
  enabled: boolean
  patterns: string[]  // built-in pattern names or custom regex strings
  method: 'replace' | 'hash' | 'remove'
  replacement: string
}

const BUILTIN_PATTERNS: Record<string, RegExp> = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(?:\+?\d{1,3}[-.\s])?\d{2,4}[-.\s]\d{3,4}[-.\s]\d{3,4}/g,
  'credit-card': /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  'resident-id': /\b\d{6}[-\s]?\d{7}\b/g,
  // Note: matches invalid octets (e.g., 999.999.999.999) to maximize recall
  'ip-address': /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
}

export class PIIRedactor {
  private patterns: RegExp[] = []
  private method: 'replace' | 'hash' | 'remove' = 'replace'
  private replacement = '[REDACTED]'

  constructor(config: RedactorConfig) {
    if (!config.enabled) return

    this.method = config.method
    this.replacement = config.replacement

    for (const pattern of config.patterns) {
      if (BUILTIN_PATTERNS[pattern]) {
        this.patterns.push(new RegExp(BUILTIN_PATTERNS[pattern].source, 'g'))
      } else {
        try {
          this.patterns.push(new RegExp(pattern, 'g'))
        } catch {}
      }
    }
  }

  redact(text: string): string {
    if (this.patterns.length === 0) return text

    let result = text
    for (const pattern of this.patterns) {
      pattern.lastIndex = 0
      if (this.method === 'hash') {
        result = result.replace(pattern, (match) => {
          return createHash('sha256').update(match).digest('hex').substring(0, 8)
        })
      } else if (this.method === 'remove') {
        result = result.replace(pattern, '')
      } else {
        result = result.replace(pattern, this.replacement)
      }
    }
    return result
  }

  isEnabled(): boolean {
    return this.patterns.length > 0
  }
}
