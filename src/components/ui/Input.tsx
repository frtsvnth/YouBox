'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-3.5 py-2 bg-input border rounded-input text-sm text-text-primary
            placeholder:text-text-tertiary transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-accent-ring focus:border-accent
            disabled:opacity-40 disabled:cursor-not-allowed
            ${error ? 'border-error ring-1 ring-error/30' : 'border-border'}
            ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-error">{error}</p>}
        {hint && !error && <p className="text-xs text-text-tertiary">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
