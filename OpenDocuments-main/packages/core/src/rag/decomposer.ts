export interface DecomposedQuery {
  original: string
  subQueries: string[]
  isDecomposed: boolean
}

/**
 * Decompose a complex query into sub-queries.
 * Detects: conjunctions (and/와/과), comparisons, multi-part questions.
 */
export function decomposeQuery(query: string): DecomposedQuery {
  const trimmed = query.trim()

  // Check for comparison patterns
  const compareMatch = trimmed.match(/(.+?)(?:\s*(?:vs\.?|versus|compared?\s+(?:to|with))\s*|(?:와|과|랑)\s*)(.+)/i)
  if (compareMatch) {
    return {
      original: trimmed,
      subQueries: [compareMatch[1].trim(), compareMatch[2].trim()],
      isDecomposed: true,
    }
  }

  // Check for "and" conjunctions splitting distinct topics
  const andMatch = trimmed.match(/(.+?)(?:\s+(?:and\s+also|and\s+then|and|또한|그리고)\s+)(.+)/i)
  if (andMatch) {
    const part1 = andMatch[1].trim()
    const part2 = andMatch[2].trim()
    // Only decompose if parts are substantially different (not just "X and Y" as a list)
    if (part1.length > 10 && part2.length > 10) {
      return {
        original: trimmed,
        subQueries: [part1, part2],
        isDecomposed: true,
      }
    }
  }

  // Check for multiple questions (separated by ? or 그리고)
  const questions = trimmed.split(/\?\s+/).filter(q => q.trim().length > 10)
  if (questions.length > 1) {
    return {
      original: trimmed,
      subQueries: questions.map(q => q.trim() + (q.endsWith('?') ? '' : '?')),
      isDecomposed: true,
    }
  }

  // No decomposition needed
  return { original: trimmed, subQueries: [trimmed], isDecomposed: false }
}
