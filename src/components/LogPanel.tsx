'use client'

import { useEffect, useState, useRef } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import type { LogEntry, LogLevel } from '@/lib/logger'

interface Props {
  open: boolean
  onClose: () => void
}

const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: 'text-text-tertiary',
  info: 'text-text-secondary',
  warn: 'text-warning',
  error: 'text-error',
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function LogPanel({ open, onClose }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const afterIdRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => {
        setLogs([])
        afterIdRef.current = 0
      }, 0)
      return () => clearTimeout(id)
    }

    fetch('/api/logs?after=0').then(r => r.ok && r.json()).then(data => {
      if (data.logs && data.logs.length > 0) {
        setLogs(data.logs)
        afterIdRef.current = data.nextId
      }
    }).catch(() => {})

    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/logs?after=${afterIdRef.current}`)
        if (res.ok) {
          const data = await res.json()
          if (data.logs.length > 0) {
            setLogs(prev => [...prev, ...data.logs])
            afterIdRef.current = data.nextId
          }
        }
      } catch { /* silent */ }
    }, 1500)

    return () => clearInterval(id)
  }, [open])

  useEffect(() => {
    if (autoScrollRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  async function handleClear() {
    await fetch('/api/logs', { method: 'POST' })
    setLogs([])
    afterIdRef.current = 0
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  }

  return (
    <Drawer open={open} onClose={onClose} title="Логи">
      <div className="flex flex-col gap-0 h-full">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] text-text-tertiary">{logs.length} записей</span>
          <button
            onClick={handleClear}
            className="ml-auto px-2 py-1 text-[11px] text-text-tertiary hover:text-text-primary
              bg-page-alt rounded-md hover:bg-card-hover transition-colors"
          >
            Очистить
          </button>
        </div>
        <div
          className="flex-1 overflow-y-auto scrollbar-thin font-mono text-[11px] leading-relaxed space-y-0.5"
          onScroll={handleScroll}
        >
          {logs.length === 0 && (
            <p className="text-text-tertiary py-4 text-center">Нет записей</p>
          )}
          {logs.map((entry) => (
            <div key={entry.id} className={`${LEVEL_STYLES[entry.level]} hover:bg-page-alt/50 px-1 py-0.5 rounded`}>
              <span className="text-text-tertiary/50">{formatTime(entry.ts)}</span>
              {' '}
              <span className="text-text-tertiary/70">[{entry.source}]</span>
              {' '}
              <span>{entry.msg}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </Drawer>
  )
}
