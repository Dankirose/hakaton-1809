import { describe, it, expect } from 'vitest'
import { decomposeQuery } from '../../src/rag/decomposer.js'

describe('decomposeQuery', () => {
  it('decomposes comparison queries', () => {
    const result = decomposeQuery('Compare REST vs GraphQL for our API')
    expect(result.isDecomposed).toBe(true)
    expect(result.subQueries).toHaveLength(2)
    expect(result.subQueries[0]).toContain('REST')
    expect(result.subQueries[1]).toContain('GraphQL')
  })

  it('decomposes Korean comparison queries', () => {
    const result = decomposeQuery('React와 Vue 차이점 알려줘')
    expect(result.isDecomposed).toBe(true)
    expect(result.subQueries.length).toBeGreaterThanOrEqual(2)
  })

  it('decomposes multi-question queries', () => {
    const result = decomposeQuery('How does authentication work? And how do I configure Redis?')
    expect(result.isDecomposed).toBe(true)
    expect(result.subQueries.length).toBeGreaterThanOrEqual(2)
  })

  it('does not decompose simple queries', () => {
    const result = decomposeQuery('How to configure Redis?')
    expect(result.isDecomposed).toBe(false)
    expect(result.subQueries).toEqual(['How to configure Redis?'])
  })
})
