'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeProvider } from '@/lib/theme-context'
import { URLBar } from '@/components/URLBar'
import { ContentCard } from '@/components/ContentCard'
import { JobList } from '@/components/JobList'
import { JobDetailsDrawer } from '@/components/JobDetailsDrawer'
import { HistoryPanel } from '@/components/HistoryPanel'
import { LogPanel } from '@/components/LogPanel'
import { PlaylistConfirmDialog } from '@/components/PlaylistConfirmDialog'
import { ThemeToggle } from '@/components/ThemeToggle'
import { EmptyState } from '@/components/ui/EmptyState'
import { InlineSpinner } from '@/components/ui/Spinner'
import type { ExtractedMetadata, Job } from '@/types'

const PRESET_MAP: Record<string, { format_id: string | null; format: 'mp4' | 'mp3' | 'webm'; mode: 'video' | 'audio' }> = {
  best: { format_id: null, format: 'mp4', mode: 'video' },
  '1080p': { format_id: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]', format: 'mp4', mode: 'video' },
  '720p': { format_id: 'bestvideo[height<=720]+bestaudio/best[height<=720]', format: 'mp4', mode: 'video' },
  mp3: { format_id: 'bestaudio[ext=m4a]', format: 'mp3', mode: 'audio' },
  m4a: { format_id: 'bestaudio[ext=m4a]', format: 'mp4', mode: 'audio' },
}

export default function DashboardPage() {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeCount, setActiveCount] = useState(0)

  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [metadata, setMetadata] = useState<ExtractedMetadata | null>(null)

  const [selectedPreset, setSelectedPreset] = useState('best')
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [creatingJob, setCreatingJob] = useState(false)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const [playlistConfirm, setPlaylistConfirm] = useState<number | null>(null)

  const lastUrlRef = useRef('')

  async function handleExtract(url: string) {
    setExtractError('')
    setMetadata(null)
    setExtracting(true)
    setShowAdvanced(false)
    setSelectedPreset('best')
    setSelectedFormatId(null)
    lastUrlRef.current = url

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Ошибка получения информации')
      }
      const data = await res.json()
      setMetadata(data.metadata)

      if (data.metadata.is_playlist && data.metadata.playlist_count && data.metadata.playlist_count > 10) {
        setPlaylistConfirm(data.metadata.playlist_count)
      }
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Ошибка соединения')
    } finally {
      setExtracting(false)
    }
  }

  function handleSelectPreset(presetId: string) {
    setSelectedPreset(presetId)
    setSelectedFormatId(null)
    setShowAdvanced(false)
  }

  function handleSelectFormat(formatId: string) {
    setSelectedFormatId(formatId)
    setSelectedPreset('best')
  }

  async function handleCreateJob(playlistMax?: number) {
    if (!metadata) return
    setCreatingJob(true)
    setPlaylistConfirm(null)

    const preset = PRESET_MAP[selectedPreset]
    const formatId = selectedFormatId || preset?.format_id || null

    const body: Record<string, unknown> = {
      url: metadata.webpage_url,
      format: preset?.format || 'mp4',
      mode: metadata.is_playlist ? 'playlist' : (preset?.mode || 'video'),
      format_id: formatId,
    }

    if (metadata.is_playlist && playlistMax) {
      body.playlist_max = playlistMax
    }

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.status === 409) {
        setRefreshKey((k) => k + 1)
        setMetadata(null)
        return
      }

      if (!res.ok) throw new Error('Ошибка при создании задачи')

      setRefreshKey((k) => k + 1)
      setMetadata(null)
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Не удалось создать задачу')
    } finally {
      setCreatingJob(false)
    }
  }

  const handleJobClick = useCallback((job: Job) => {
    setSelectedJob(job)
    setDetailsOpen(true)
  }, [])

  const handleJobRetry = useCallback(async (id: string) => {
    try {
      await fetch(`/api/jobs/${id}/retry`, { method: 'POST' })
      setRefreshKey((k) => k + 1)
    } catch { /* silent */ }
  }, [])

  const handleJobReRun = useCallback((job: Job) => {
    lastUrlRef.current = job.url
    handleExtract(job.url)
    setHistoryOpen(false)
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  async function handleCancel(id: string) {
    try {
      await fetch(`/api/jobs/${id}/cancel`, { method: 'POST' })
      setRefreshKey((k) => k + 1)
    } catch { /* silent */ }
  }

  const handleJobDelete = useCallback(async (id: string) => {
    try {
      await fetch(`/api/jobs/${id}/delete`, { method: 'POST' })
      setRefreshKey((k) => k + 1)
      setSelectedJob(null)
      setDetailsOpen(false)
    } catch { /* silent */ }
  }, [])

  return (
    <ThemeProvider>
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-page/80 backdrop-blur-md border-b border-border">
          <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-accent">
                  <rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                  <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M9 9l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-text-primary">YouBox - только для своих</span>
            </div>
            <div className="flex items-center gap-0.5">
              <ThemeToggle />
              <button
                onClick={() => setLogsOpen(true)}
                className="p-2 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-card-hover transition-colors"
                aria-label="Логи"
                title="Логи"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
              <button
                onClick={() => setHistoryOpen(true)}
                className="p-2 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-card-hover transition-colors relative"
                aria-label="История задач"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M8 5v3.5l3 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-card-hover transition-colors"
                aria-label="Выйти"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <path d="M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
          <div className="flex flex-col gap-4">
            <URLBar onExtract={handleExtract} extracting={extracting} />

            {extractError && (
              <div className="bg-error-subtle border border-error/20 rounded-lg px-4 py-3">
                <div className="flex items-start gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5 text-error">
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M7 4.5v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <div>
                    <p className="text-xs font-medium text-error mb-0.5">Ошибка</p>
                    <p className="text-xs text-error/80">{extractError}</p>
                  </div>
                </div>
              </div>
            )}

            {extracting && (
              <div className="flex items-center justify-center py-12">
                <InlineSpinner label="Получение информации о видео..." />
              </div>
            )}

            {metadata && !extracting && (
              <div className="flex flex-col gap-3">
                <ContentCard
                  metadata={metadata}
                  selectedPreset={selectedPreset}
                  onSelectPreset={handleSelectPreset}
                  selectedFormatId={selectedFormatId}
                  onSelectFormat={handleSelectFormat}
                  showAdvanced={showAdvanced}
                  onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
                />
                <button
                  onClick={() => handleCreateJob()}
                  disabled={creatingJob}
                  className="w-full py-2.5 bg-accent text-white text-sm font-medium rounded-btn
                    hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {creatingJob ? 'Создание задачи...' : 'Скачать'}
                </button>
              </div>
            )}

            {!metadata && !extracting && !extractError && (
              <EmptyState
                icon="search"
                title="Что будем скачивать?"
                description="Вставьте ссылку на YouTube видео или плейлист и нажмите «Показать варианты»"
              />
            )}

            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Задачи
                  {activeCount > 0 && (
                    <span className="ml-1.5 text-accent font-bold">· {activeCount}</span>
                  )}
                </h2>
              </div>
              <JobList
                key={refreshKey}
                onJobClick={handleJobClick}
                onJobRetry={handleJobRetry}
                onJobReRun={handleJobReRun}
                onActiveCount={setActiveCount}
              />
            </div>
          </div>
        </main>

        <PlaylistConfirmDialog
          open={playlistConfirm !== null}
          playlistCount={playlistConfirm || 0}
          onConfirm={(max) => handleCreateJob(max)}
          onCancel={() => setPlaylistConfirm(null)}
        />

        <JobDetailsDrawer
          job={selectedJob}
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          onCancel={handleCancel}
          onDelete={handleJobDelete}
          onRetry={handleJobRetry}
          onReRun={handleJobReRun}
        />

        <HistoryPanel
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onJobClick={handleJobClick}
          onJobDelete={handleJobDelete}
          onJobReRun={handleJobReRun}
          onJobRetry={handleJobRetry}
        />

        <LogPanel
          open={logsOpen}
          onClose={() => setLogsOpen(false)}
        />
      </div>
    </ThemeProvider>
  )
}
