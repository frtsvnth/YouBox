'use client'

import type { FormatInfo } from '@/types'

interface Props {
  formats: FormatInfo[]
  selectedId: string | null
  onSelect: (formatId: string) => void
}

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatTbr(tbr: number | null): string {
  if (tbr === null || tbr === 0) return '—'
  return `${Math.round(tbr)} kbps`
}

export function FormatTable({ formats, selectedId, onSelect }: Props) {
  const sorted = [...formats].sort((a, b) => {
    const aScore = a.filesize ?? 0
    const bScore = b.filesize ?? 0
    return bScore - aScore
  })

  if (formats.length === 0) {
    return <p className="text-xs text-text-tertiary py-4 text-center">Нет доступных форматов</p>
  }

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-text-tertiary border-b border-border">
            <th className="text-left py-2 px-2 font-medium">Формат</th>
            <th className="text-left py-2 px-2 font-medium">Разрешение</th>
            <th className="text-left py-2 px-2 font-medium">Размер</th>
            <th className="text-left py-2 px-2 font-medium">Битрейт</th>
            <th className="text-left py-2 px-2 font-medium">Кодек</th>
            <th className="w-8 px-2" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((f) => {
            const isSelected = f.format_id === selectedId
            const isVideo = f.vcodec !== 'none'
            const isAudio = f.acodec !== 'none'
            const label = f.format_note || f.format_id

            return (
              <tr
                key={f.format_id}
                onClick={() => onSelect(f.format_id)}
                className={`border-b border-divider cursor-pointer transition-colors duration-100
                  ${isSelected ? 'bg-accent-subtle' : 'hover:bg-card-hover'}`}
              >
                <td className="py-2.5 px-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{label}</span>
                    <span className="text-text-tertiary">.{f.ext}</span>
                  </div>
                </td>
                <td className="py-2.5 px-2 text-text-secondary">{f.resolution || '—'}</td>
                <td className="py-2.5 px-2 text-text-secondary font-medium tabular-nums">
                  {formatSize(f.filesize)}
                </td>
                <td className="py-2.5 px-2 text-text-secondary tabular-nums">{formatTbr(f.tbr)}</td>
                <td className="py-2.5 px-2 text-text-secondary">
                  <span className="text-[10px]">{isVideo ? '🎬 ' : ''}{isAudio ? '🔊 ' : ''}</span>
                  {f.vcodec !== 'none' ? f.vcodec : ''}
                  {f.vcodec !== 'none' && f.acodec !== 'none' ? ' / ' : ''}
                  {f.acodec !== 'none' ? f.acodec : ''}
                </td>
                <td className="py-2.5 px-2">
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors
                    ${isSelected ? 'border-accent bg-accent' : 'border-border'}`}
                  >
                    {isSelected && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4l1.5 1.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
