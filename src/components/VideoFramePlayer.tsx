'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { sanitizeFilename } from '@/lib/filename'

interface Props {
  jobId: string
  title: string | null
  onClose: () => void
}

function formatTimecode(seconds: number, fps: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const frame = Math.floor((seconds - Math.floor(seconds)) * fps)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(frame).padStart(2, '0')}`
}

export function VideoFramePlayer({ jobId, title, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [fps, setFps] = useState(30)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/jobs/${jobId}/probe`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.fps) setFps(data.fps)
      })
      .catch(() => { /* используем fps по умолчанию */ })
    return () => { cancelled = true }
  }, [jobId])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stepFrame(-1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); stepFrame(1) }
      else if (e.key === ' ') { e.preventDefault(); togglePlay() }
    }
    window.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fps, duration])

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  const stepFrame = useCallback((dir: 1 | -1) => {
    const video = videoRef.current
    if (!video || !Number.isFinite(duration) || duration <= 0) return
    video.pause()
    const next = Math.min(Math.max(video.currentTime + dir * (1 / fps), 0), duration)
    video.currentTime = next
  }, [fps, duration])

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const video = videoRef.current
    if (!video) return
    video.currentTime = parseFloat(e.target.value)
  }

  function handleSaveFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const base = sanitizeFilename(title ?? 'frame', '')
      const stamp = formatTimecode(video.currentTime, fps).replace(/[:.]/g, '-')
      const a = document.createElement('a')
      a.href = url
      a.download = `${base}_${stamp}.png`
      a.click()
      URL.revokeObjectURL(url)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 'image/png')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-overlay" onClick={onClose} aria-hidden />
      <div
        className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Просмотр видео"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-text-primary truncate pr-4">{title || 'Просмотр видео'}</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-text-tertiary hover:text-text-primary rounded-md hover:bg-card-hover transition-colors shrink-0"
            aria-label="Закрыть"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="relative bg-black flex items-center justify-center min-h-[240px]">
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner className="h-6 w-6" />
            </div>
          )}
          {error && (
            <div className="p-6 text-center text-sm text-error">{error}</div>
          )}
          <video
            ref={videoRef}
            src={`/api/jobs/${jobId}/stream`}
            className="max-h-[55vh] max-w-full"
            playsInline
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration)
              setReady(true)
            }}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onSeeked={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => setError('Не удалось загрузить видео для просмотра')}
          />
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="px-5 py-4 flex flex-col gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums text-text-tertiary w-20 shrink-0">
              {formatTimecode(currentTime, fps)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={1 / fps}
              value={currentTime}
              onChange={handleSeek}
              disabled={!ready}
              className="flex-1 accent-accent h-1.5 cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="text-xs tabular-nums text-text-tertiary w-20 shrink-0 text-right">
              {formatTimecode(duration, fps)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                onClick={() => stepFrame(-1)}
                disabled={!ready}
                title="Предыдущий кадр (←)"
                className="p-2 text-text-secondary hover:text-accent rounded-md hover:bg-card-hover transition-colors disabled:opacity-40"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3l-4 5 4 5M13 3l-4 5 4 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={togglePlay}
                disabled={!ready}
                title="Пауза / воспроизведение (пробел)"
                className="p-2 text-text-secondary hover:text-accent rounded-md hover:bg-card-hover transition-colors disabled:opacity-40"
              >
                {playing ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="4" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
                    <rect x="9" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4.5 3v10l9-5-9-5z" fill="currentColor" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => stepFrame(1)}
                disabled={!ready}
                title="Следующий кадр (→)"
                className="p-2 text-text-secondary hover:text-accent rounded-md hover:bg-card-hover transition-colors disabled:opacity-40"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 3l4 5-4 5M3 3l4 5-4 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <button
              onClick={handleSaveFrame}
              disabled={!ready}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-btn bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v8M3.5 6.5L7 10l3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M1.5 10.5v2h11v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              {saved ? 'Кадр сохранён' : 'Сохранить кадр'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
