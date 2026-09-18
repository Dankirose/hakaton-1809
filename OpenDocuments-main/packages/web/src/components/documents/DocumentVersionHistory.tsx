import { useEffect, useRef, useState } from 'react'
import { History, GitCompareArrows, Minus, Plus, PencilLine } from 'lucide-react'
import { getDocumentVersionDiff, listDocumentVersions } from '../../lib/api'
import type { DocumentVersion, DocumentVersionDiff } from '../../lib/types'
import { useAppStore } from '../../stores/appStore'
import { translate as tr } from '../../lib/i18n'

interface Props {
  documentId: string
  /** Bump to open the diff for the latest version (used by the header link). */
  compareSignal?: number
  /** Reports how many versions exist so the parent can show/hide the link. */
  onVersionsLoaded?: (count: number) => void
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

export function DocumentVersionHistory({ documentId, compareSignal = 0, onVersionsLoaded }: Props) {
  const { locale } = useAppStore()
  const t = (key: string, values?: Record<string, string | number>) => tr(locale, key, values)
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeDiff, setActiveDiff] = useState<DocumentVersionDiff | null>(null)
  const [diffVersion, setDiffVersion] = useState<number | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const sectionRef = useRef<HTMLElement | null>(null)
  const handledSignal = useRef(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listDocumentVersions(documentId)
      .then((data) => {
        if (!cancelled) {
          setVersions(data.versions)
          onVersionsLoaded?.(data.versions.length)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('docDetail.versionLoadError'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [documentId, onVersionsLoaded])

  const loadDiff = async (version: number) => {
    setDiffVersion(version)
    setDiffLoading(true)
    setError(null)
    try {
      const diff = await getDocumentVersionDiff(documentId, { to: version })
      setActiveDiff(diff)
    } catch (err) {
      setActiveDiff(null)
      setError(err instanceof Error ? err.message : t('docDetail.versionLoadError'))
    } finally {
      setDiffLoading(false)
    }
  }

  useEffect(() => {
    if (compareSignal <= 0 || handledSignal.current === compareSignal) return
    if (versions.length < 2) return
    handledSignal.current = compareSignal
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    void loadDiff(versions[0].version)
  }, [compareSignal, versions])

  const toggleDiff = async (version: DocumentVersion) => {
    if (diffVersion === version.version) {
      setDiffVersion(null)
      setActiveDiff(null)
      return
    }
    await loadDiff(version.version)
  }

  return (
    <section ref={sectionRef} className="scroll-mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History size={17} className="text-slate-500" />
          <h3 className="text-[15px] font-semibold text-slate-950">{t('docDetail.versionHistory')}</h3>
        </div>
        {!loading && versions.length > 1 && (
          <button
            onClick={() => void loadDiff(versions[0].version)}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700"
          >
            <GitCompareArrows size={14} />
            {t('docDetail.compareVersionsLink', { from: versions[1].version, to: versions[0].version })}
          </button>
        )}
      </div>

      {loading && <p className="mt-3 text-[13px] text-slate-400">{t('common.loading')}</p>}
      {!loading && error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
      {!loading && !error && versions.length === 0 && (
        <p className="mt-3 text-[13px] text-slate-500">{t('docDetail.noVersions')}</p>
      )}

      {!loading && versions.length > 0 && (
        <div className="mt-4 space-y-3">
          {versions.map((version) => {
            const isOpen = diffVersion === version.version
            return (
              <div key={version.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[12px] font-semibold text-slate-700">
                      v{version.version}
                    </span>
                    {version.isActive && (
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        {t('docDetail.currentVersion')}
                      </span>
                    )}
                    <span className="text-[12px] text-slate-500">{formatDate(version.createdAt)}</span>
                    <span className="text-[12px] text-slate-500">
                      {t('docDetail.chunkCountLabel', { count: version.chunkCount ?? 0 })}
                    </span>
                  </div>
                  {version.version > 1 && (
                    <button
                      onClick={() => void toggleDiff(version)}
                      className="flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <GitCompareArrows size={13} />
                      {isOpen ? t('docDetail.hideDiff') : t('docDetail.comparePrevious')}
                    </button>
                  )}
                </div>

                {version.changes && (
                  <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
                    <span className="flex items-center gap-1 text-emerald-700"><Plus size={12} /> {version.changes.added}</span>
                    <span className="flex items-center gap-1 text-amber-700"><PencilLine size={12} /> {version.changes.modified}</span>
                    <span className="flex items-center gap-1 text-red-700"><Minus size={12} /> {version.changes.removed}</span>
                    <span className="text-slate-400">{t('docDetail.unchanged')}: {version.changes.unchanged}</span>
                  </div>
                )}

                {isOpen && (
                  <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                    {diffLoading && <p className="text-[12px] text-slate-400">{t('common.loading')}</p>}
                    {!diffLoading && activeDiff && activeDiff.changes.added + activeDiff.changes.modified + activeDiff.changes.removed === 0 && (
                      <p className="text-[12px] text-slate-500">{t('docDetail.noChanges')}</p>
                    )}
                    {!diffLoading && activeDiff && activeDiff.added.map((chunk) => (
                      <p key={`add-${chunk.position}`} className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] leading-5 text-emerald-800">
                        <span className="font-semibold">+ </span>{chunk.content}
                      </p>
                    ))}
                    {!diffLoading && activeDiff && activeDiff.modified.map((item) => (
                      <div key={`mod-${item.after.position}`} className="space-y-1">
                        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-800 line-through">
                          {item.before.content}
                        </p>
                        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-800">
                          {item.after.content}
                        </p>
                      </div>
                    ))}
                    {!diffLoading && activeDiff && activeDiff.removed.map((chunk) => (
                      <p key={`del-${chunk.position}`} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-800 line-through">
                        {chunk.content}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
