'use client'

import { useEffect } from 'react'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Подтвердить', cancelLabel = 'Отмена',
  variant = 'default', onConfirm, onCancel, loading,
}: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-overlay" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-2">{title}</h3>
        <p className="text-sm text-text-secondary mb-5 leading-relaxed">{message}</p>
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-3.5 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-btn hover:bg-card-hover transition-colors disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-btn transition-colors disabled:opacity-40
              ${variant === 'danger'
                ? 'bg-error text-white hover:bg-error/90'
                : 'bg-accent text-white hover:bg-accent-hover'}`}
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
