'use client'

interface Props {
  open: boolean
  playlistCount: number
  onConfirm: (max: number) => void
  onCancel: () => void
}

export function PlaylistConfirmDialog({ open, playlistCount, onConfirm, onCancel }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-overlay" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-2">
          Большой плейлист
        </h3>
        <p className="text-sm text-text-secondary mb-4 leading-relaxed">
          Плейлист содержит <strong className="text-text-primary">{playlistCount}</strong> видео.
          Скачивание такого объёма может занять много времени и места.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onConfirm(playlistCount)}
            className="w-full py-2 px-4 bg-accent text-white text-sm font-medium rounded-btn hover:bg-accent-hover transition-colors"
          >
            Скачать всё ({playlistCount})
          </button>
          <button
            onClick={() => onConfirm(5)}
            className="w-full py-2 px-4 bg-page-alt text-text-primary border border-border text-sm font-medium rounded-btn hover:bg-card-hover transition-colors"
          >
            Первые 5
          </button>
          <button
            onClick={() => onConfirm(10)}
            className="w-full py-2 px-4 bg-page-alt text-text-primary border border-border text-sm font-medium rounded-btn hover:bg-card-hover transition-colors"
          >
            Первые 10
          </button>
          <button
            onClick={() => onConfirm(1)}
            className="w-full py-2 px-4 bg-page-alt text-text-primary border border-border text-sm font-medium rounded-btn hover:bg-card-hover transition-colors"
          >
            Только первое видео
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2 px-4 text-text-tertiary text-sm rounded-btn hover:text-text-primary transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
