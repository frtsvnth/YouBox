'use client'

import type { Job } from '@/types'
import { Drawer } from '@/components/ui/Drawer'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
  created: { label: 'Создано', variant: 'neutral' },
  extracting: { label: 'Получение информации', variant: 'info' },
  queued: { label: 'В очереди', variant: 'warning' },
  downloading: { label: 'Скачивание', variant: 'info' },
  muxing: { label: 'Обработка', variant: 'info' },
  ready: { label: 'Готово', variant: 'success' },
  failed: { label: 'Ошибка', variant: 'error' },
  expired: { label: 'Истекло', variant: 'neutral' },
}

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString('ru-RU', {
    day: 'numeric', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

interface Props {
  job: Job | null
  open: boolean
  onClose: () => void
  onCancel?: (id: string) => void
  onRetry?: (id: string) => void
  onReRun?: (job: Job) => void
}

export function JobDetailsDrawer({ job, open, onClose, onCancel, onRetry, onReRun }: Props) {
  if (!job) return null
  const j = job

  const config = STATUS_CONFIG[j.status] || STATUS_CONFIG.created
  const isActive = ['queued', 'downloading', 'muxing', 'extracting'].includes(j.status)
  const showProgress = ['downloading', 'muxing'].includes(j.status) && j.progress > 0

  function handleDownload() {
    const a = document.createElement('a')
    a.href = `/api/download/${j.id}`
    a.click()
  }

  return (
    <Drawer open={open} onClose={onClose} title="Детали задачи">
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-1">{j.title || 'Без названия'}</h3>
          <p className="text-xs text-text-tertiary break-all">{j.url}</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={config.variant}>{config.label}</Badge>
          {j.mode && (
            <Badge variant="neutral">{j.mode === 'audio' ? 'Аудио' : j.mode === 'video' ? 'Видео' : 'Плейлист'}</Badge>
          )}
        </div>

        {showProgress && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-text-secondary">{j.status === 'muxing' ? 'Обработка...' : 'Скачивание...'}</span>
              <span className="text-xs text-text-tertiary tabular-nums">{Math.round(j.progress)}%</span>
            </div>
            <ProgressBar value={j.progress} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="Формат" value={j.format?.toUpperCase() || '—'} />
          <InfoRow label="Размер" value={formatSize(j.filesize)} />
          {j.playlist_size && j.playlist_size > 1 && (
            <InfoRow label="Позиция в плейлисте" value={`${j.playlist_index || 1} / ${j.playlist_size}`} />
          )}
          <InfoRow label="ID формата" value={j.format_id || '—'} />
          <InfoRow label="Создана" value={formatDate(j.created_at)} />
          {j.ready_at && <InfoRow label="Готова" value={formatDate(j.ready_at)} />}
          {j.expires_at && <InfoRow label="Истекает" value={formatDate(j.expires_at)} />}
        </div>

        {j.status === 'failed' && j.error_message && (
          <div className="bg-error-subtle border border-error/20 rounded-lg px-3.5 py-2.5">
            <p className="text-xs font-medium text-error mb-1">Ошибка</p>
            <p className="text-xs text-error/80 leading-relaxed">{j.error_message}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {j.status === 'ready' && (
            <Button size="md" onClick={handleDownload}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v8M3.5 6.5L7 10l3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M1.5 10.5v2h11v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Скачать файл
            </Button>
          )}
          {isActive && onCancel && (
            <Button variant="danger" size="md" onClick={() => onCancel(j.id)}>
              Отменить
            </Button>
          )}
          {j.status === 'failed' && onRetry && (
            <Button variant="primary" size="md" onClick={() => onRetry(j.id)}>
              Повторить
            </Button>
          )}
          {j.status === 'ready' && onReRun && (
            <Button variant="secondary" size="md" onClick={() => onReRun(j)}>
              Запустить снова
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-text-tertiary mb-0.5">{label}</p>
      <p className="text-xs text-text-primary font-medium">{value}</p>
    </div>
  )
}
