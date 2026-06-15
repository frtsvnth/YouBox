'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed shadow-sm',
  secondary:
    'bg-page-alt text-text-primary border border-border hover:bg-card-hover disabled:opacity-40 disabled:cursor-not-allowed',
  ghost:
    'text-text-secondary hover:text-text-primary hover:bg-card-hover disabled:opacity-40 disabled:cursor-not-allowed',
  danger:
    'bg-error/10 text-error hover:bg-error/20 disabled:opacity-40 disabled:cursor-not-allowed',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs rounded-btn',
  md: 'px-3.5 py-2 text-sm rounded-btn',
  lg: 'px-5 py-2.5 text-sm rounded-btn',
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', loading, disabled, children, className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150
          ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
            <path d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
