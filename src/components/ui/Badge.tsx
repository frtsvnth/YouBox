'use client'

interface Props {
  children: string
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
  className?: string
}

const variants = {
  default: 'bg-accent-subtle text-accent',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  error: 'bg-error-subtle text-error',
  info: 'bg-info-subtle text-info',
  neutral: 'bg-page-alt text-text-secondary',
}

export function Badge({ children, variant = 'default', className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium leading-4 rounded-badge whitespace-nowrap ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
