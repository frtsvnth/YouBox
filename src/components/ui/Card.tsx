'use client'

import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

export function Card({ children, className = '', hover, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className={`bg-card border border-border rounded-card
        ${hover ? 'transition-colors duration-150 cursor-pointer hover:bg-card-hover' : ''}
        ${className}`}
    >
      {children}
    </div>
  )
}
