'use client'

import type { Job } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'

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

const STAGE_LABELS: Record<string, string> = {
  extracting: 'Извлечение информации…',
  downloading: 'Скачивание…',
  muxing: 'Обработка аудио…',
}

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatSpeed(bytesPerSec: number | null): string {
  if (bytesPerSec === null || bytesPerSec === 0) return ''
  if (bytesPerSec >= 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(1)} GiB/s`
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MiB/s`
  if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(0)} KiB/s`
  return `${bytesPerSec} B/s`
}

function formatEta(seconds: number | null): string {
  if (seconds === null) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp * 1000
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч назад`
  const days = Math.floor(hours / 24)
  return `${days} д назад`
}

interface Props {
  job: Job
  onCancel?: (id: string) => void
  onDelete?: (id: string) => void
  onRetry?: (id: string) => void
  onReRun?: (job: Job) => void
  onClick?: (job: Job) => void
  compact?: boolean
  fresh?: boolean
}

export function JobCard({ job, onCancel, onDelete, onRetry, onReRun, onClick, compact, fresh }: Props) {
  const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.created

  const isProgressing = ['downloading', 'muxing'].includes(job.status)

  const indeterminate = isProgressing && (job.progress <= 0 || (job.status === 'muxing'))

  const handleClick = () => {
    if (onClick) onClick(job)
  }

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onRetry) onRetry(job.id)
  }

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onCancel) onCancel(job.id)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDelete) onDelete(job.id)
  }

  const handleReRun = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onReRun) onReRun(job)
  }

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = `/api/download/${job.id}`
    a.click()
  }

  return (
    <div
      onClick={handleClick}
      className={`bg-card border rounded-lg transition-all duration-200
        ${onClick ? 'cursor-pointer hover:border-accent/30 hover:shadow-sm' : ''}
        ${compact ? 'px-3 py-2.5' : 'px-4 py-3'}
        ${job.status === 'ready' ? 'border-success/30 bg-success-subtle/[0.03]' : 'border-border'}
        ${job.status === 'failed' ? 'border-error/30 bg-error-subtle/[0.03]' : ''}
        ${fresh ? 'animate-fresh-ready' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className={`font-medium text-text-primary truncate ${compact ? 'text-xs' : 'text-sm'}`}>
              {job.title || job.url}
            </p>
            <Badge variant={config.variant}>{config.label}</Badge>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-text-tertiary">
            {job.filesize && job.status === 'ready' && (
              <span>{formatSize(job.filesize)}</span>
            )}
            {job.playlist_size && job.playlist_size > 1 && (
              <span>{job.playlist_index || 1}/{job.playlist_size}</span>
            )}
            {job.mode && (
              <span className="capitalize">
                {job.mode === 'audio' ? 'Аудио' : job.mode === 'video' ? 'Видео' : 'Плейлист'}
              </span>
            )}
            <span>{timeAgo(job.created_at)}</span>
          </div>

          {isProgressing && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">
                  {STAGE_LABELS[job.current_stage] || config.label}
                </span>
                {!indeterminate && (
                  <span className="text-xs text-text-tertiary tabular-nums">
                    {Math.round(job.progress)}%
                  </span>
                )}
              </div>
              <ProgressBar value={job.progress} indeterminate={indeterminate} />
              {(job.progress_speed !== null || job.progress_eta !== null || (job.progress_downloaded !== null && job.progress_total !== null)) && (
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-text-tertiary">
                  {job.progress_speed !== null && job.progress_speed > 0 && (
                    <span>{formatSpeed(job.progress_speed)}</span>
                  )}
                  {job.progress_eta !== null && job.progress_eta > 0 && (
                    <span>· ETA {formatEta(job.progress_eta)}</span>
                  )}
                  {job.progress_downloaded !== null && (
                    <span>
                      · {formatSize(job.progress_downloaded)}
                      {job.progress_total !== null && job.progress_total > 0 && ` / ${formatSize(job.progress_total)}`}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {job.status === 'extracting' && (
            <div className="mt-2">
              <ProgressBar
                value={0}
                indeterminate
                label="Получение информации…"
              />
            </div>
          )}

          {job.status === 'failed' && job.error_message && !compact && (
            <p className="text-xs text-error mt-1.5 line-clamp-2">{job.error_message}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {job.status === 'ready' && (
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
              aria-label="Скачать"
            >
              Скачать
            </button>
          )}
          {job.status === 'failed' && onRetry && (
            <button
              onClick={handleRetry}
              className="p-1.5 text-text-secondary hover:text-accent rounded-md transition-colors"
              aria-label="Повторить"
              title="Повторить"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M12.5 4.5a6 6 0 1 0 1 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M9 4.5h3.5V1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {(job.status === 'ready' || job.status === 'failed' || job.status === 'expired') && onReRun && (
            <button
              onClick={handleReRun}
              className="p-1.5 text-text-secondary hover:text-accent rounded-md transition-colors"
              aria-label="Запустить снова"
              title="Запустить снова"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M11.5 2.5l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2.5 8.5a5 5 0 0 1 5-5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M3.5 12.5l-2-2 2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12.5 6.5a5 5 0 0 1-5 5h-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          )}
          {onCancel && (job.status === 'queued' || job.status === 'downloading' || job.status === 'extracting') && (
            <button
              onClick={handleCancel}
              className="p-1.5 text-text-tertiary hover:text-error rounded-md transition-colors"
              aria-label="Отмена"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M4 4l7 7M11 4l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          )}
          {onDelete && !['queued', 'downloading', 'extracting'].includes(job.status) && (
            <button
              onClick={handleDelete}
              className="p-1.5 text-text-tertiary hover:text-error rounded-md transition-colors"
              aria-label="Удалить"
              title="Удалить"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M3 4h9M5.5 4V2.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V4M6 7v4M9 7v4M2.5 4l1 8.5a1 1 0 0 0 1 .5h6a1 1 0 0 0 1-.5l1-8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
