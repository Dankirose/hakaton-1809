import { useState, useRef, useEffect } from 'react'
import { Paperclip, Send, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { translate as tr } from '../../lib/i18n'
import type { UploadProgress } from '../../lib/api'

interface Props {
  onSend: (query: string) => void
  onAttach?: (file: File) => Promise<{ id: string; name: string }>
  onRemove?: (id: string) => Promise<void>
  disabled?: boolean
  sendDisabled?: boolean
  disabledReason?: string
  uploading?: boolean
  attachProgress?: UploadProgress | null
  className?: string
}

export function ChatInput({
  onSend,
  onAttach,
  onRemove,
  disabled,
  sendDisabled,
  disabledReason,
  uploading,
  attachProgress,
  className = '',
}: Props) {
  const { locale } = useAppStore()
  const t = (key: string, values?: Record<string, string | number>) => tr(locale, key, values)
  const [input, setInput] = useState('')
  const [attachStatus, setAttachStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [attachedFile, setAttachedFile] = useState<{ id: string; name: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const stageLabel = (progress: UploadProgress): string => {
    switch (progress.stage) {
      case 'received':
        return t('chat.uploadStage.received')
      case 'parsed':
        return t('chat.uploadStage.parsed', { chunks: progress.chunks ?? 0 })
      case 'chunked':
        return t('chat.uploadStage.chunked', { chunks: progress.chunks ?? 0 })
      case 'embedding':
        return t('chat.uploadStage.embedding', {
          processed: progress.processed ?? 0,
          total: progress.total ?? 0,
        })
      case 'indexed':
        return t('chat.uploadStage.indexed', { chunks: progress.chunks ?? 0 })
      case 'skipped':
        return t('chat.uploadStage.skipped')
      case 'error':
        return t('chat.uploadStage.error')
      default:
        return t('chat.uploadingSource')
    }
  }

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus()
  }, [disabled])

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (!trimmed || disabled || sendDisabled) return
    onSend(trimmed)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleAttach = async (file: File | undefined) => {
    if (!file || !onAttach || disabled || uploading) return
    setAttachStatus('uploading')
    try {
      const result = await onAttach(file)
      setAttachedFile(result)
      setAttachStatus('success')
    } catch {
      setAttachStatus('error')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    if (!attachedFile || !onRemove) return
    try {
      await onRemove(attachedFile.id)
      setAttachedFile(null)
      setAttachStatus('idle')
    } catch {
      setAttachStatus('error')
    }
  }

  return (
    <div className={`rounded-lg border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.09)] ${className}`}>
      <div className="flex min-h-[116px] flex-col px-6 py-5">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabledReason || t('chat.placeholder')}
          disabled={disabled || sendDisabled}
          rows={1}
          className="min-h-[36px] flex-1 resize-none border-0 bg-transparent p-0 text-[15px] leading-6 text-slate-950 placeholder-slate-400 outline-none disabled:opacity-50"
          style={{ maxHeight: '76px' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = 'auto'
            target.style.height = Math.min(target.scrollHeight, 76) + 'px'
          }}
        />
        <div className="mt-4 flex items-end justify-between">
          {onAttach ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => void handleAttach(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || uploading}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={t('chat.uploadSource')}
                title={uploading ? t('chat.uploadingSource') : t('chat.uploadSource')}
              >
                {attachStatus === 'uploading' ? (
                  <Loader2 size={19} strokeWidth={2} className="animate-spin text-blue-500" />
                ) : attachStatus === 'success' ? (
                  <CheckCircle2 size={19} strokeWidth={2} className="text-emerald-500" />
                ) : attachStatus === 'error' ? (
                  <AlertCircle size={19} strokeWidth={2} className="text-red-500" />
                ) : (
                  <Paperclip size={19} strokeWidth={2} />
                )}
              </button>
              {attachStatus === 'uploading' && attachProgress && (
                <span className="ml-2 inline-flex items-center gap-1.5 text-[12px] text-blue-600">
                  <span>{stageLabel(attachProgress)}</span>
                </span>
              )}
              {attachedFile && (
                <span className="ml-2 inline-flex max-w-[240px] items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[12px] text-slate-600">
                  <span className="truncate">{attachedFile.name}</span>
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={uploading}
                    aria-label={t('common.remove')}
                    className="shrink-0 text-slate-400 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                </span>
              )}
            </div>
          ) : <div />}
          <button
            onClick={handleSubmit}
            disabled={disabled || sendDisabled || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-[0_6px_14px_rgba(37,99,235,0.28)] transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t('chat.sendQuestion')}
          >
            <Send size={19} strokeWidth={2.1} />
          </button>
        </div>
      </div>
    </div>
  )
}
