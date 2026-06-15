'use client'

interface Props {
  value: number
  className?: string
}

export function ProgressBar({ value, className = '' }: Props) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className={`h-1.5 bg-page-alt rounded-full overflow-hidden ${className}`} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
