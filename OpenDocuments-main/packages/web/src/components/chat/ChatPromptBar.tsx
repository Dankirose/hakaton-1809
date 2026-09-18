import { useEffect, useMemo, useState } from 'react'
import { Plus, Settings2, Trash2, X } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { translate as tr } from '../../lib/i18n'
import { listPrompts, createPrompt, updatePrompt, deletePrompt } from '../../lib/api'
import type { ChatPrompt } from '../../lib/types'

interface Props {
  value: string | null
  onChange: (promptId: string | null) => void
}

export function ChatPromptBar({ value, onChange }: Props) {
  const { locale } = useAppStore()
  const t = (key: string, values?: Record<string, string | number>) => tr(locale, key, values)
  const [prompts, setPrompts] = useState<ChatPrompt[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState(false)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listPrompts()
      setPrompts(result.prompts)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('prompts.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const selected = useMemo(() => prompts.find((p) => p.id === value) ?? null, [prompts, value])

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-9 flex-1 rounded-md border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none focus:border-blue-400"
          aria-label={t('prompts.selector')}
        >
          <option value="">{t('prompts.none')}</option>
          {prompts.map((prompt) => (
            <option key={prompt.id} value={prompt.id}>{prompt.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setManageOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
          title={t('prompts.manage')}
        >
          <Settings2 size={15} />
          {t('prompts.manage')}
        </button>
      </div>
      {selected && (
        <p className="mt-1.5 line-clamp-1 text-[11px] text-slate-400">{selected.description || selected.content.slice(0, 120)}</p>
      )}
      {error && <p className="mt-1.5 text-[11px] text-red-500">{error}</p>}

      {manageOpen && (
        <PromptManagerModal
          prompts={prompts}
          loading={loading}
          error={error}
          onClose={() => setManageOpen(false)}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}

function PromptManagerModal({
  prompts,
  loading,
  error,
  onClose,
  onRefresh,
}: {
  prompts: ChatPrompt[]
  loading: boolean
  error: string | null
  onClose: () => void
  onRefresh: () => Promise<void>
}) {
  const { locale } = useAppStore()
  const t = (key: string, values?: Record<string, string | number>) => tr(locale, key, values)
  const [editing, setEditing] = useState<ChatPrompt | null>(null)
  const [draft, setDraft] = useState({ name: '', description: '', content: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const startNew = () => {
    setEditing(null)
    setDraft({ name: '', description: '', content: '' })
  }

  const startEdit = (prompt: ChatPrompt) => {
    setEditing(prompt)
    setDraft({ name: prompt.name, description: prompt.description ?? '', content: prompt.content })
  }

  const save = async () => {
    if (!draft.name.trim() || !draft.content.trim()) {
      setFormError(t('prompts.nameContentRequired'))
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updatePrompt(editing.id, {
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          content: draft.content,
        })
      } else {
        await createPrompt({
          name: draft.name.trim(),
          description: draft.description.trim() || undefined,
          content: draft.content,
        })
      }
      await onRefresh()
      startNew()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('prompts.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (prompt: ChatPrompt) => {
    if (!window.confirm(t('prompts.deleteConfirm', { name: prompt.name }))) return
    try {
      await deletePrompt(prompt.id)
      await onRefresh()
      if (editing?.id === prompt.id) startNew()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('prompts.deleteError'))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-[16px] font-semibold text-slate-950">{t('prompts.title')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={t('common.close')}
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid max-h-[calc(90vh-120px)] grid-cols-1 gap-0 md:grid-cols-[240px_1fr]">
          <div className="overflow-auto border-b border-slate-200 md:border-b-0 md:border-r">
            <div className="p-3">
              <button
                type="button"
                onClick={startNew}
                className="flex w-full items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
              >
                <Plus size={14} /> {t('prompts.new')}
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {loading && <p className="px-4 py-3 text-[12px] text-slate-400">{t('common.loading')}</p>}
              {!loading && prompts.length === 0 && (
                <p className="px-4 py-3 text-[12px] text-slate-400">{t('prompts.empty')}</p>
              )}
              {prompts.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  onClick={() => startEdit(prompt)}
                  className={`block w-full px-4 py-2.5 text-left text-[13px] hover:bg-slate-50 ${
                    editing?.id === prompt.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                  }`}
                >
                  <span className="block truncate font-medium">{prompt.name}</span>
                  {prompt.description && (
                    <span className="block truncate text-[11px] text-slate-400">{prompt.description}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-auto p-4">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-slate-700">{t('prompts.name')}</label>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-blue-400"
                  placeholder={t('prompts.namePlaceholder')}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-slate-700">{t('prompts.description')}</label>
                <input
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-blue-400"
                  placeholder={t('prompts.descriptionPlaceholder')}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-slate-700">{t('prompts.content')}</label>
                <textarea
                  value={draft.content}
                  onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                  rows={12}
                  className="w-full resize-y rounded-md border border-slate-200 px-3 py-2 font-mono text-[12px] outline-none focus:border-blue-400"
                  placeholder={t('prompts.contentPlaceholder')}
                />
              </div>
              {formError && <p className="text-[12px] text-red-500">{formError}</p>}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? t('common.loading') : editing ? t('common.save') : t('common.create')}
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={() => remove(editing)}
                    className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} /> {t('common.delete')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
