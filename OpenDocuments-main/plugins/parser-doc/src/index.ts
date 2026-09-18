import WordExtractor from 'word-extractor'
import type { ParserPlugin, RawDocument, ParsedChunk, PluginContext, HealthStatus } from 'opendocuments-core'

const HEADING_MAX_LENGTH = 100
const HEADING_MAX_WORDS = 7

/**
 * Heuristic heading detection for legacy Word files: `.doc` carries no
 * structural markup once extracted, so section titles are inferred from
 * short, punctuation-free, title-style or upper-case lines.
 */
function isHeading(line: string): boolean {
  const text = line.trim()
  if (text.length < 3 || text.length > HEADING_MAX_LENGTH) return false
  if (/[.;:,!?]$/.test(text)) return false
  if (/^[-–—•*·]/.test(text)) return false

  const words = text.split(/\s+/).filter(Boolean)
  if (words.length > HEADING_MAX_WORDS) return false

  // ALL CAPS lines (e.g. "ДОЛЖНОСТНАЯ ИНСТРУКЦИЯ")
  if (/^[А-ЯЁA-Z0-9№«»()\][\-–—\s./]+$/.test(text) && /[А-ЯЁA-Z]/.test(text)) return true

  // Title-style lines (e.g. "Общие положения", "Права")
  return /^[А-ЯЁA-Z]/.test(text) && !/[.!?]/.test(text)
}

function normalizeBody(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .replace(/\t+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map(line => line.trim())
}

interface Section {
  heading: string[]
  lines: string[]
}

function splitIntoSections(lines: string[]): Section[] {
  const sections: Section[] = []
  let current: Section = { heading: [], lines: [] }

  for (const line of lines) {
    if (!line) {
      current.lines.push('')
      continue
    }
    if (isHeading(line)) {
      if (current.lines.some(l => l.trim())) {
        sections.push(current)
        current = { heading: [line], lines: [] }
      } else if (current.heading.length > 0) {
        current.heading.push(line)
      } else {
        current.heading = [line]
      }
      continue
    }
    current.lines.push(line)
  }

  if (current.lines.some(l => l.trim()) || current.heading.length > 0) {
    sections.push(current)
  }

  return sections
}

function renderSection(section: Section): string {
  const paragraphs: string[] = []
  let buffer: string[] = []

  const flush = () => {
    const text = buffer.join(' ').trim()
    if (text) paragraphs.push(text)
    buffer = []
  }

  for (const line of section.lines) {
    if (!line) {
      flush()
      continue
    }
    buffer.push(line)
  }
  flush()

  return paragraphs.join('\n\n')
}

export class DOCParser implements ParserPlugin {
  name = '@opendocuments/parser-doc'
  type = 'parser' as const
  version = '0.1.0'
  coreVersion = '^0.3.0'
  supportedTypes = ['.doc']

  async setup(_ctx: PluginContext): Promise<void> {}
  async healthCheck(): Promise<HealthStatus> { return { healthy: true } }

  async *parse(raw: RawDocument): AsyncIterable<ParsedChunk> {
    const extractor = new WordExtractor()

    const buffer = typeof raw.content === 'string'
      ? Buffer.from(raw.content, 'binary')
      : Buffer.from(raw.content)

    const doc = await extractor.extract(buffer)
    const body = doc.getBody()
    if (!body?.trim()) return

    for (const section of splitIntoSections(normalizeBody(body))) {
      const content = renderSection(section)
      if (!content) continue
      yield {
        content,
        chunkType: 'semantic',
        headingHierarchy: section.heading,
      }
    }
  }
}

export default DOCParser
