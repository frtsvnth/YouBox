'use client'

interface Props {
  value: number
  className?: string
  indeterminate?: boolean
  label?: string
  showPercent?: boolean
}

export function ProgressBar({ value, className = '', indeterminate = false, label, showPercent = false }: Props) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="flex-1 h-1.5 bg-page-alt rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full ${
            indeterminate
              ? 'bg-accent/50 w-1/3 animate-indeterminate'
              : 'bg-accent w-full'
          }`}
          style={indeterminate ? {} : {
            width: `${clamped}%`,
            transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
      {label && (
        <span className="text-xs text-text-tertiary truncate shrink-0 max-w-[140px]">{label}</span>
      )}
      {showPercent && !indeterminate && (
        <span className="text-xs text-text-tertiary tabular-nums shrink-0 w-[2.6ch] text-right">{Math.round(clamped)}%</span>
      )}
    </div>
  )
}
