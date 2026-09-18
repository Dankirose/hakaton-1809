import { describe, it, expect } from 'vitest'
import { PIIRedactor } from '../../src/security/redactor.js'

describe('PIIRedactor', () => {
  it('redacts email addresses', () => {
    const redactor = new PIIRedactor({
      enabled: true, patterns: ['email'], method: 'replace', replacement: '[REDACTED]',
    })
    expect(redactor.redact('Contact john@example.com for info'))
      .toBe('Contact [REDACTED] for info')
  })

  it('redacts phone numbers', () => {
    const redactor = new PIIRedactor({
      enabled: true, patterns: ['phone'], method: 'replace', replacement: '[PHONE]',
    })
    expect(redactor.redact('Call 010-1234-5678')).toBe('Call [PHONE]')
  })

  it('redacts credit card numbers', () => {
    const redactor = new PIIRedactor({
      enabled: true, patterns: ['credit-card'], method: 'replace', replacement: '[CC]',
    })
    expect(redactor.redact('Card: 4111-1111-1111-1111')).toBe('Card: [CC]')
  })

  it('supports custom regex patterns', () => {
    const redactor = new PIIRedactor({
      enabled: true, patterns: ['계좌[\\s]*번호[\\s]*[:：]?\\s*\\d+'],
      method: 'replace', replacement: '[ACCOUNT]',
    })
    expect(redactor.redact('계좌번호: 1234567890')).toBe('[ACCOUNT]')
  })

  it('does nothing when disabled', () => {
    const redactor = new PIIRedactor({
      enabled: false, patterns: ['email'], method: 'replace', replacement: '[X]',
    })
    expect(redactor.redact('john@example.com')).toBe('john@example.com')
  })

  it('supports remove method', () => {
    const redactor = new PIIRedactor({
      enabled: true, patterns: ['email'], method: 'remove', replacement: '',
    })
    expect(redactor.redact('Contact john@example.com now'))
      .toBe('Contact  now')
  })

  it('handles multiple patterns', () => {
    const redactor = new PIIRedactor({
      enabled: true, patterns: ['email', 'phone'], method: 'replace', replacement: '[PII]',
    })
    expect(redactor.redact('Email: a@b.com Phone: 010-1234-5678'))
      .toBe('Email: [PII] Phone: [PII]')
  })

  it('supports hash method', () => {
    const redactor = new PIIRedactor({
      enabled: true, patterns: ['email'], method: 'hash', replacement: '',
    })
    const result = redactor.redact('Contact john@example.com for info')
    // Should not contain the original email
    expect(result).not.toContain('john@example.com')
    // Should contain an 8-char hex hash
    expect(result).toMatch(/Contact [a-f0-9]{8} for info/)
  })

  it('redacts IP addresses', () => {
    const redactor = new PIIRedactor({
      enabled: true, patterns: ['ip-address'], method: 'replace', replacement: '[IP]',
    })
    expect(redactor.redact('Server at 192.168.1.100')).toBe('Server at [IP]')
  })
})
