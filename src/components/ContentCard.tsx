'use client'

import type { ExtractedMetadata } from '@/types'
import { FormatTable } from './FormatTable'

export interface Preset {
  id: string
  label: string
  description: string
  formatId: string | null
  ext: string
  mode: 'video' | 'audio'
}

const PRESETS: Preset[] = [
  { id: 'best', label: 'Best quality', description: 'Максимальное качество', formatId: null, ext: 'mp4', mode: 'video' },
  { id: '1080p', label: 'MP4 1080p', description: 'Full HD видео', formatId: null, ext: 'mp4', mode: 'video' },
  { id: '720p', label: 'MP4 720p', description: 'HD видео', formatId: null, ext: 'mp4', mode: 'video' },
  { id: 'mp3', label: 'Audio only MP3', description: 'Только аудио MP3', formatId: null, ext: 'mp3', mode: 'audio' },
  { id: 'm4a', label: 'Audio only M4A', description: 'Только аудио M4A', formatId: null, ext: 'm4a', mode: 'audio' },
]

interface Props {
  metadata: ExtractedMetadata
  selectedPreset: string
  onSelectPreset: (presetId: string) => void
  onSelectFormat: (formatId: string) => void
  selectedFormatId: string | null
  showAdvanced: boolean
  onToggleAdvanced: () => void
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const y = dateStr.slice(0, 4)
  const m = dateStr.slice(4, 6)
  const d = dateStr.slice(6, 8)
  return `${d}.${m}.${y}`
}

export function ContentCard({
  metadata,
  selectedPreset,
  onSelectPreset,
  onSelectFormat,
  selectedFormatId,
  showAdvanced,
  onToggleAdvanced,
}: Props) {
  const hasThumb = metadata.thumbnail && !metadata.thumbnail.includes('default')

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {hasThumb && (
          <div className="relative w-full sm:w-56 h-40 sm:h-auto shrink-0 bg-page-alt">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={metadata.thumbnail!}
              alt={metadata.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1 min-w-0 p-4">
          <div className="flex items-start gap-2 mb-1">
            <h2 className="text-sm font-semibold text-text-primary leading-snug line-clamp-2">
              {metadata.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary mb-3">
            {metadata.uploader && (
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                  <circle cx="6" cy="4" r="2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M2 10.5c0-2 1.79-4 4-4s4 2 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                {metadata.uploader}
              </span>
            )}
            {metadata.duration && (
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M6 3.5V6l2 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                {formatDuration(metadata.duration)}
              </span>
            )}
            {metadata.upload_date && (
              <span>{formatDate(metadata.upload_date)}</span>
            )}
            {metadata.is_playlist && metadata.playlist_count && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-info-subtle text-info rounded text-[10px] font-medium">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="1" y="1.5" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
                  <rect x="1" y="4.5" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.7" />
                  <rect x="1" y="7.5" width="6" height="2" rx="0.5" fill="currentColor" />
                </svg>
                Плейлист · {metadata.playlist_count}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-btn border transition-all duration-150
                  ${selectedPreset === preset.id
                    ? 'bg-accent text-white border-accent shadow-sm'
                    : 'bg-page-alt text-text-secondary border-border hover:border-accent hover:text-accent'}`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button
            onClick={onToggleAdvanced}
            className="text-xs text-text-tertiary hover:text-accent transition-colors flex items-center gap-1"
          >
            {showAdvanced ? 'Скрыть все форматы' : 'Все форматы'}
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              className={`transition-transform duration-150 ${showAdvanced ? 'rotate-180' : ''}`}
            >
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {showAdvanced && (
        <div className="border-t border-border px-4 py-3">
          <div className="text-xs font-medium text-text-secondary mb-2">Все доступные форматы</div>
          <FormatTable
            formats={metadata.formats}
            selectedId={selectedFormatId}
            onSelect={onSelectFormat}
          />
        </div>
      )}
    </div>
  )
}
