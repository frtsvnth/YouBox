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

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
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
  onRetry?: (id: string) => void
  onReRun?: (job: Job) => void
  onClick?: (job: Job) => void
  compact?: boolean
}

export function JobCard({ job, onCancel, onRetry, onReRun, onClick, compact }: Props) {
  const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.created
  const showProgress = ['downloading', 'muxing'].includes(job.status) && job.progress > 0

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
      className={`bg-card border border-border rounded-lg transition-all duration-150
        ${onClick ? 'cursor-pointer hover:border-accent/30 hover:shadow-sm' : ''}
        ${compact ? 'px-3 py-2.5' : 'px-4 py-3'}`}
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
              <span className="capitalize">{job.mode === 'audio' ? 'Аудио' : job.mode === 'video' ? 'Видео' : 'Плейлист'}</span>
            )}
            <span>{timeAgo(job.created_at)}</span>
          </div>
          {showProgress && (
            <div className="mt-2 flex items-center gap-2.5">
              <ProgressBar value={job.progress} className="flex-1 max-w-[160px]" />
              <span className="text-xs text-text-tertiary tabular-nums">{Math.round(job.progress)}%</span>
            </div>
          )}
          {job.status === 'failed' && job.error_message && !compact && (
            <p className="text-xs text-error mt-1.5 line-clamp-1">{job.error_message}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {job.status === 'ready' && (
            <button
              onClick={handleDownload}
              className="p-1.5 text-accent hover:bg-accent-subtle rounded-md transition-colors"
              aria-label="Скачать"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M7.5 2v8M4 7.5l3.5 3.5L11 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 11.5v1.5h11v-1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          )}
          {job.status === 'failed' && onRetry && (
            <button
              onClick={handleRetry}
              className="p-1.5 text-text-secondary hover:text-accent rounded-md transition-colors"
              aria-label="Повторить"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M12.5 4.5a6 6 0 1 0 1 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M9 4.5h3.5V1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {job.status === 'ready' && onReRun && (
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
          {onCancel && (job.status === 'queued' || job.status === 'downloading') && (
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
        </div>
      </div>
    </div>
  )
}
