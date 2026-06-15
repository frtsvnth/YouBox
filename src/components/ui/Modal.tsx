'use client'

import { useEffect, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  actions?: ReactNode
}

export function Modal({ open, onClose, title, children, actions }: Props) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-overlay" onClick={onClose} aria-hidden />
      <div
        className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto scrollbar-thin animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-text-primary">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 text-text-tertiary hover:text-text-primary rounded-md hover:bg-card-hover transition-colors"
              aria-label="Закрыть"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {actions && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-page-alt rounded-b-xl">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
