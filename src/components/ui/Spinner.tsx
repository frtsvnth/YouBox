'use client'

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-accent ${className || 'h-5 w-5'}`}
      viewBox="0 0 16 16"
      fill="none"
      aria-label="Загрузка"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
      <path d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function PageSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

export function InlineSpinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-text-secondary">
      <Spinner className="h-4 w-4" />
      {label && <span>{label}</span>}
    </div>
  )
}
