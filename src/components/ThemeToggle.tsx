'use client'

import { useTheme } from '@/lib/theme-context'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      className="p-2 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-card-hover transition-colors"
      aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
    >
      {theme === 'dark' ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 1v1.5M8 13.5V15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M1 8h1.5M13.5 8H15M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M13.5 9.06A6.5 6.5 0 0 1 6.94 2.5 6.5 6.5 0 1 0 13.5 9.06z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
