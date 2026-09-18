import { Command } from 'commander'
import { log } from 'opendocuments-core'
import chalk from 'chalk'
import { getContext, shutdownContext } from '../utils/bootstrap.js'

export function documentCommand() {
  const cmd = new Command('document').description('Manage documents')

  cmd.command('list').description('List indexed documents').action(async () => {
    const ctx = await getContext()
    try {
      const docs = ctx.store.listDocuments()
      if (docs.length === 0) { log.info('No documents indexed'); return }
      log.heading('Documents')
      for (const d of docs) {
        const status = d.status === 'indexed' ? chalk.green('[ok]') : d.status === 'error' ? chalk.red('[!!]') : chalk.yellow('[..]')
        log.dim(`  ${status} ${(d.title || '').padEnd(30)} ${String(d.chunk_count || 0).padStart(4)} chunks  ${d.source_type}`)
      }
    } finally { await shutdownContext() }
  })

  cmd.command('get <id>').description('Get document details').action(async (id) => {
    const ctx = await getContext()
    try {
      const doc = ctx.store.getDocument(id)
      if (!doc) { log.fail('Document not found'); return }
      console.log(JSON.stringify(doc, null, 2))
    } finally { await shutdownContext() }
  })

  cmd.command('delete <id>').description('Delete a document (soft)').action(async (id) => {
    const ctx = await getContext()
    try {
      await ctx.store.softDeleteDocument(id)
      log.ok('Document moved to trash')
    } finally { await shutdownContext() }
  })

  cmd.command('restore <id>').description('Restore a deleted document').action(async (id) => {
    const ctx = await getContext()
    try {
      ctx.store.restoreDocument(id)
      log.ok('Document restored (needs re-indexing)')
    } finally { await shutdownContext() }
  })

  cmd.command('trash').description('List deleted documents').action(async () => {
    const ctx = await getContext()
    try {
      const docs = ctx.store.listDeletedDocuments()
      if (docs.length === 0) { log.info('Trash is empty'); return }
      log.heading('Trash')
      for (const d of docs) {
        log.dim(`  ${(d.title || '').padEnd(30)} deleted: ${d.deleted_at}`)
      }
    } finally { await shutdownContext() }
  })

  cmd.command('versions <id>').description('List version history of a document').action(async (id) => {
    const ctx = await getContext()
    try {
      const versions = ctx.versionManager.listVersions(id)
      if (versions.length === 0) { log.info('No versions recorded'); return }
      log.heading('Document versions')
      for (const v of versions) {
        const active = v.isActive ? chalk.green(' [active]') : ''
        const changes = v.changes
          ? `  +${v.changes.added} ~${v.changes.modified} -${v.changes.removed}`
          : ''
        log.dim(`  v${String(v.version).padStart(3)}  ${v.createdAt}  ${String(v.chunkCount ?? 0).padStart(4)} chunks${changes}${active}`)
      }
    } finally { await shutdownContext() }
  })

  cmd.command('diff <id>')
    .description('Show what changed in a document version')
    .option('--from <version>', 'From version (default: previous)')
    .option('--to <version>', 'To version (default: latest)')
    .action(async (id, opts: { from?: string; to?: string }) => {
      const ctx = await getContext()
      try {
        const latest = ctx.versionManager.getLatestVersion(id)
        if (!latest) { log.fail('No versions recorded for document'); return }
        const to = opts.to ? Number.parseInt(opts.to, 10) : latest.version
        const from = opts.from ? Number.parseInt(opts.from, 10) : to - 1
        if (Number.isNaN(to) || Number.isNaN(from) || from < 1) {
          log.fail('Invalid version range'); return
        }
        const diff = ctx.versionManager.diffVersions(id, from, to)
        if (!diff) { log.fail('Version not found'); return }
        log.heading(`Changes v${from} -> v${to}`)
        log.info(`added: ${diff.changes.added}  modified: ${diff.changes.modified}  removed: ${diff.changes.removed}  unchanged: ${diff.changes.unchanged}`)
        for (const chunk of diff.added) log.ok(`+ ${chunk.content.slice(0, 120)}`)
        for (const item of diff.modified) log.info(`~ ${item.after.content.slice(0, 120)}`)
        for (const chunk of diff.removed) log.fail(`- ${chunk.content.slice(0, 120)}`)
      } finally { await shutdownContext() }
    })

  cmd.command('compare <leftId> <rightId>')
    .description('Compare two documents (active versions)')
    .action(async (leftId, rightId) => {
      const ctx = await getContext()
      try {
        const result = ctx.versionManager.compareDocuments(leftId, rightId)
        if (!result) { log.fail('Cannot compare these documents (no recorded versions)'); return }
        log.heading(`Compare: ${result.left.title}  vs  ${result.right.title}`)
        log.info(`similarity: ${(result.similarity * 100).toFixed(1)}%  ` +
          `added: ${result.changes.added}  modified: ${result.changes.modified}  ` +
          `removed: ${result.changes.removed}  unchanged: ${result.changes.unchanged}`)
        for (const chunk of result.added) log.ok(`+ [${result.right.title}] ${chunk.content.slice(0, 120)}`)
        for (const item of result.modified) {
          log.fail(`- [${result.left.title}] ${item.before.content.slice(0, 120)}`)
          log.ok(`+ [${result.right.title}] ${item.after.content.slice(0, 120)}`)
        }
        for (const chunk of result.removed) log.fail(`- [${result.left.title}] ${chunk.content.slice(0, 120)}`)
      } finally { await shutdownContext() }
    })

  return cmd
}
