'use client'

interface Props {
  icon?: 'search' | 'download' | 'error' | 'empty' | 'history'
  title: string
  description?: string
  action?: React.ReactNode
}

const icons = {
  search: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect x="8" y="6" width="24" height="28" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="20" cy="18" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 22l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  download: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <path d="M20 8v16M12 18l8 8 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 28v4h24v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  error: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 16l8 8M24 16l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  empty: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect x="8" y="6" width="24" height="28" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 14h12M14 20h8M14 26h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  history: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20 12v8l6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

export function EmptyState({ icon = 'empty', title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-text-tertiary mb-4">{icons[icon]}</div>
      <h3 className="text-sm font-medium text-text-primary mb-1">{title}</h3>
      {description && <p className="text-xs text-text-tertiary max-w-[280px]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
