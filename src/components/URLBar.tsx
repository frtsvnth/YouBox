'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'

interface Props {
  onExtract: (url: string) => Promise<void>
  extracting: boolean
}

export function URLBar({ onExtract, extracting }: Props) {
  const [url, setUrl] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!url.trim() || extracting) return
    await onExtract(url.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path d="M6.5 11a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z" stroke="currentColor" strokeWidth="1.3" />
            <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Вставьте ссылку на видео или плейлист..."
            className="w-full pl-9 pr-3.5 py-2.5 bg-input border border-border rounded-input text-sm text-text-primary placeholder:text-text-tertiary
              focus:outline-none focus:ring-2 focus:ring-accent-ring focus:border-accent transition-all duration-150"
          />
        </div>
        <Button type="submit" disabled={!url.trim() || extracting} loading={extracting}>
          Показать варианты
        </Button>
      </div>
    </form>
  )
}
