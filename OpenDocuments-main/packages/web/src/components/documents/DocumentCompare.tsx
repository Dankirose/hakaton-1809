import { useEffect, useState } from 'react'
import { GitCompareArrows, Minus, Plus, PencilLine } from 'lucide-react'
import { compareDocuments, listDocuments } from '../../lib/api'
import type { Document, DocumentComparison } from '../../lib/types'
import { useAppStore } from '../../stores/appStore'
import { translate as tr } from '../../lib/i18n'

export function DocumentCompare() {
  const { locale } = useAppStore()
  const t = (key: string, values?: Record<string, string | number>) => tr(locale, key, values)
  const [documents, setDocuments] = useState<Document[]>([])
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const [result, setResult] = useState<DocumentComparison | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadDocuments = async () => {
    const data = await listDocuments()
    setDocuments(data.documents.filter((doc) => doc.status === 'indexed'))
  }

  useEffect(() => { void loadDocuments() }, [])

  const runCompare = async () => {
    setError(null)
    if (!leftId || !rightId) {
      setError(t('documents.compareNeedTwo'))
      setResult(null)
      return
    }
    if (leftId === rightId) {
      setError(t('documents.compareSame'))
      setResult(null)
      return
    }
    setLoading(true)
    try {
      setResult(await compareDocuments(leftId, rightId))
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : t('documents.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const select = (key: string, value: string) => (
    <select
      value={value}
      onChange={(event) => (key === 'left' ? setLeftId(event.target.value) : setRightId(event.target.value))}
      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-blue-300"
    >
      <option value="">{t('documents.compareSelect')}</option>
      {documents.map((doc) => (
        <option key={doc.id} value={doc.id}>{doc.title}</option>
      ))}
    </select>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-blue-600">{t('documents.eyebrow')}</p>
          <h2 className="mt-1 text-[26px] font-semibold tracking-normal">{t('documents.compareTitle')}</h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-slate-500">{t('documents.compareSubtitle')}</p>
        </div>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('documents.compareLeft')}</p>
            {select('left', leftId)}
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('documents.compareRight')}</p>
            {select('right', rightId)}
          </div>
          <div className="flex items-end">
            <button
              onClick={() => void runCompare()}
              disabled={loading}
              className="flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <GitCompareArrows size={15} />
              {t('documents.compareRun')}
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
      </section>

      {result && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-slate-900">{result.left.title}</p>
              <p className="text-[12px] text-slate-400">vs {result.right.title}</p>
            </div>
            <div className="flex flex-wrap gap-3 text-[12px]">
              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                {t('documents.compareSimilarity')}: {(result.similarity * 100).toFixed(1)}%
              </span>
              <span className="flex items-center gap-1 text-emerald-700"><Plus size={12} /> {result.changes.added}</span>
              <span className="flex items-center gap-1 text-amber-700"><PencilLine size={12} /> {result.changes.modified}</span>
              <span className="flex items-center gap-1 text-red-700"><Minus size={12} /> {result.changes.removed}</span>
              <span className="text-slate-400">{result.changes.unchanged} {t('documents.compareUnchanged')}</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {result.changes.added + result.changes.modified + result.changes.removed === 0 && (
              <p className="text-[13px] text-slate-500">{t('documents.compareNoChanges')}</p>
            )}
            {result.added.map((chunk) => (
              <p key={`add-${chunk.position}`} className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] leading-5 text-emerald-800">
                <span className="font-semibold">+ </span>{chunk.content}
              </p>
            ))}
            {result.modified.map((item) => (
              <div key={`mod-${item.after.position}`} className="space-y-1">
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-800 line-through">
                  {item.before.content}
                </p>
                <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-800">
                  {item.after.content}
                </p>
              </div>
            ))}
            {result.removed.map((chunk) => (
              <p key={`del-${chunk.position}`} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-800 line-through">
                {chunk.content}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
