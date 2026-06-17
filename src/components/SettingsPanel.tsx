'use client'

import { useState, useEffect, useCallback } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { CookieSource, CookieSourceSummary } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
}

const SOURCE_LABELS: Record<string, string> = {
  uploaded_file: 'Загруженный файл',
  browser_session: 'Браузерная сессия',
}

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  active: 'success',
  missing: 'error',
  stale: 'warning',
  invalid: 'error',
  disabled: 'neutral',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Активен',
  missing: 'Файл не найден',
  stale: 'Устарел',
  invalid: 'Невалиден',
  disabled: 'Отключён',
}

function formatDate(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('ru-RU')
}

function SourceRow({
  source,
  onActivate,
  onValidate,
  onDelete,
  onExport,
  isActive,
}: {
  source: CookieSource
  onActivate: (id: string) => void
  onValidate: (id: string) => void
  onDelete: (id: string) => void
  onExport?: (id: string) => void
  isActive: boolean
}) {
  const [validating, setValidating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            {SOURCE_LABELS[source.source_type] || source.source_type}
          </span>
          <Badge variant={STATUS_VARIANTS[source.status] || 'neutral'}>
            {STATUS_LABELS[source.status] || source.status}
          </Badge>
        </div>
        {isActive && (
          <Badge variant="info">Выбран</Badge>
        )}
      </div>

      <div className="text-xs text-text-tertiary space-y-0.5">
        {source.source_type === 'uploaded_file' && source.uploaded_at && (
          <p>Загружен: {formatDate(source.uploaded_at)}</p>
        )}
        {source.source_type === 'browser_session' && source.exported_at && (
          <p>Экспортирован: {formatDate(source.exported_at)}</p>
        )}
        {source.validated_at && (
          <p>Проверен: {formatDate(source.validated_at)}</p>
        )}
        {source.error_message && (
          <p className="text-error mt-1">{source.error_message}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 mt-2">
        {!isActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onActivate(source.id)}
          >
            Сделать активным
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          loading={validating}
          onClick={async () => {
            setValidating(true)
            await onValidate(source.id)
            setValidating(false)
          }}
        >
          Проверить
        </Button>
        {source.source_type === 'browser_session' && onExport && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onExport(source.id)}
          >
            Экспорт
          </Button>
        )}
        <Button
          variant="danger"
          size="sm"
          loading={deleting}
          onClick={async () => {
            setDeleting(true)
            await onDelete(source.id)
            setDeleting(false)
          }}
        >
          Удалить
        </Button>
      </div>
    </Card>
  )
}

export function SettingsPanel({ open, onClose }: Props) {
  const [summary, setSummary] = useState<CookieSourceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [browserStatus, setBrowserStatus] = useState<{
    running: boolean
    profileExists: boolean
    browserUrl: string | null
    error: string | null
  } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/cookie-source')
      if (res.ok) {
        const data = await res.json()
        setSummary(data)
      }
    } catch {
      /* skip */
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchBrowserStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/cookie-source/browser-status')
      if (res.ok) {
        setBrowserStatus(await res.json())
      }
    } catch {
      /* skip */
    }
  }, [])

  useEffect(() => {
    fetchSummary()
    fetchBrowserStatus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/cookie-source/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Ошибка загрузки')
      }

      const data = await res.json()
      setMessage({
        type: data.validated ? 'success' : 'error',
        text: data.validated
          ? 'Cookies загружены и активированы'
          : `Файл загружен, но не прошёл проверку: ${data.error || ''}`,
      })
      fetchSummary()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Ошибка загрузки' })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleActivate(id: string) {
    setMessage(null)
    try {
      const res = await fetch(`/api/cookie-source/${id}/activate`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Ошибка активации')
      }
      setMessage({ type: 'success', text: 'Источник активирован' })
      fetchSummary()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Ошибка активации' })
    }
  }

  async function handleValidate(id: string) {
    setMessage(null)
    try {
      const res = await fetch(`/api/cookie-source/${id}/validate`, { method: 'POST' })
      const data = await res.json()
      setMessage({
        type: data.valid ? 'success' : 'error',
        text: data.valid
          ? 'Cookies валидны'
          : `Ошибка: ${data.error || 'Неизвестная ошибка'}`,
      })
      fetchSummary()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Ошибка проверки' })
    }
  }

  async function handleDelete(id: string) {
    setDeleteConfirm(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/cookie-source/${id}/delete`, { method: 'POST' })
      if (!res.ok) throw new Error('Ошибка удаления')
      setMessage({ type: 'success', text: 'Источник удалён' })
      fetchSummary()
      fetchBrowserStatus()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Ошибка удаления' })
    }
  }

  const [openingBrowser, setOpeningBrowser] = useState(false)
  const [sshCopied, setSshCopied] = useState(false)

  async function handleOpenBrowser() {
    setOpeningBrowser(true)
    setMessage(null)
    try {
      const res = await fetch('/api/cookie-source/browser-open', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setMessage({ type: 'success', text: 'Браузер запущен, YouTube открыт' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Не удалось запустить браузер' })
      }
      fetchBrowserStatus()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Ошибка запуска браузера' })
    } finally {
      setOpeningBrowser(false)
    }
  }

  const VPS_HOST = 'youbox.pupupu.cloud'

  function handleCopySsh() {
    navigator.clipboard.writeText(`ssh -L 3808:localhost:3808 root@${VPS_HOST}`)
    setSshCopied(true)
    setTimeout(() => setSshCopied(false), 2000)
  }

  async function handleBrowserExport() {
    setExporting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/cookie-source/browser-export', { method: 'POST' })
      const data = await res.json()
      if (!data.ok) {
        throw new Error(data.error || 'Ошибка экспорта')
      }
      setMessage({
        type: data.validated ? 'success' : 'error',
        text: data.validated
          ? 'Cookies экспортированы из браузера и активированы'
          : `Экспорт выполнен, но проверка не пройдена: ${data.error || ''}`,
      })
      fetchSummary()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Ошибка экспорта' })
    } finally {
      setExporting(false)
    }
  }

  const activeSourceId = summary?.activeSource?.id ?? null

  return (
    <Drawer open={open} onClose={onClose} title="Настройки">
      <div className="space-y-6">
        {/* Theme */}
        <div>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Оформление
          </h3>
          <div className="flex items-center justify-between bg-card border border-border rounded-card px-4 py-3">
            <span className="text-sm text-text-primary">Тёмная / светлая тема</span>
            <ThemeToggle />
          </div>
        </div>

        {/* Cookie Sources */}
        <div>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Источники cookies
          </h3>

          {message && (
            <div
              className={`px-3 py-2 rounded-lg text-xs mb-3 ${
                message.type === 'success'
                  ? 'bg-success-subtle text-success'
                  : 'bg-error-subtle text-error'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Upload Section */}
          <Card className="p-4 mb-3">
            <h4 className="text-sm font-medium text-text-primary mb-2">Загрузить cookies.txt</h4>
            <p className="text-xs text-text-tertiary mb-3">
              Загрузите файл cookies.txt в формате Netscape. Файл будет сохранён на сервере и
              автоматически активирован.
            </p>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-btn
                bg-page-alt text-text-primary border border-border hover:bg-card-hover
                disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer">
                <span>{uploading ? 'Загрузка...' : 'Выбрать файл'}</span>
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          </Card>

          {/* Browser Session Section */}
          <Card className="p-4 mb-3">
            <h4 className="text-sm font-medium text-text-primary mb-2">
              🖥️ Браузерная сессия на VPS
            </h4>

            {!summary?.browserEnabled && (
              <div className="space-y-3">
                <p className="text-xs text-text-tertiary">
                  Режим отключён. В <code className="text-accent text-[11px]">.env</code> на сервере
                  добавьте:
                </p>
                <code className="block text-xs bg-page-alt border border-border rounded-lg p-2.5 text-accent font-mono">
                  ENABLE_BROWSER_COOKIE_SOURCE=true<br />
                  BROWSER_COOKIE_SERVICE_URL=http://youbox-browser:3808
                </code>
                <p className="text-xs text-text-tertiary">
                  И запустите: <code className="text-accent text-[11px]">docker compose --profile browser up -d youbox-browser</code>
                </p>
              </div>
            )}

            {summary?.browserEnabled && (
              <div className="space-y-4">
                {/* Status bar */}
                <div className="flex items-center gap-2 text-xs">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    browserStatus?.running ? 'bg-success' : browserStatus?.profileExists ? 'bg-warning' : 'bg-error'
                  }`} />
                  <span className="text-text-secondary">
                    {browserStatus?.running
                      ? 'Браузер запущен'
                      : browserStatus?.profileExists
                        ? 'Профиль есть, браузер остановлен'
                        : 'Браузер не запущен'}
                  </span>
                  {browserStatus?.error && (
                    <span className="text-error ml-1">({browserStatus.error})</span>
                  )}
                </div>

                {/* Main action button */}
                <button
                  onClick={handleOpenBrowser}
                  disabled={openingBrowser}
                  className="w-full py-2.5 bg-accent text-white text-sm font-medium rounded-btn
                    hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {openingBrowser ? 'Запуск...' : '🌐 Открыть браузер и YouTube'}
                </button>

                {/* Instructions (shown after browser is started) */}
                {browserStatus?.running && (
                  <div className="bg-page-alt border border-border rounded-lg p-3 space-y-3">
                    <p className="text-xs font-medium text-text-primary">Как войти в аккаунт:</p>

                    <div className="flex gap-3 items-start">
                      <span className="w-5 h-5 rounded-full bg-card-hover flex items-center justify-center text-[11px] font-medium shrink-0 mt-0.5">1</span>
                      <div className="text-xs text-text-secondary leading-relaxed">
                        Выполните в терминале на своём компьютере:
                        <div className="flex items-center gap-2 mt-1.5"
                          onClick={handleCopySsh}
                        >
                          <code className="flex-1 text-[11px] bg-page border border-border rounded-md px-2.5 py-1.5 text-accent font-mono cursor-pointer hover:bg-card-hover select-all">
                            ssh -L 3808:localhost:3808 root@youbox.pupupu.cloud
                          </code>
                          <button
                            className="shrink-0 text-[11px] px-2 py-1.5 bg-page-alt border border-border rounded-md
                              text-text-secondary hover:text-text-primary hover:bg-card-hover transition-colors"
                            onClick={handleCopySsh}
                          >
                            {sshCopied ? '✓' : '📋'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start">
                      <span className="w-5 h-5 rounded-full bg-card-hover flex items-center justify-center text-[11px] font-medium shrink-0 mt-0.5">2</span>
                      <div className="text-xs text-text-secondary leading-relaxed">
                        Откройте <strong className="text-text-primary">Chrome</strong> на своём компьютере,
                        перейдите на <code className="text-accent text-[11px]">chrome://inspect</code>
                        <br />Нажмите «Configure...» и добавьте <code className="text-accent text-[11px]">localhost:3808</code>
                        <br />Нажмите «inspect» на вкладке YouTube.
                      </div>
                    </div>

                    <div className="flex gap-3 items-start">
                      <span className="w-5 h-5 rounded-full bg-card-hover flex items-center justify-center text-[11px] font-medium shrink-0 mt-0.5">3</span>
                      <div className="text-xs text-text-secondary leading-relaxed">
                        В открывшемся браузере нажмите <strong className="text-text-primary">«Войти»</strong> на YouTube
                        и войдите в аккаунт. Сессия сохранится в профиле.
                      </div>
                    </div>

                    <div className="flex gap-3 items-start">
                      <span className="w-5 h-5 rounded-full bg-card-hover flex items-center justify-center text-[11px] font-medium shrink-0 mt-0.5">4</span>
                      <div className="text-xs text-text-secondary leading-relaxed">
                        Вернитесь в YouBox и нажмите <strong className="text-text-primary">«Экспортировать cookies»</strong>.
                      </div>
                    </div>
                  </div>
                )}

                {/* Export button */}
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={fetchBrowserStatus}>
                    Обновить статус
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={exporting}
                    onClick={handleBrowserExport}
                    disabled={!browserStatus?.running && !browserStatus?.profileExists}
                  >
                    📦 Экспортировать cookies
                  </Button>
                </div>

                {browserStatus?.profileExists && !browserStatus?.running && (
                  <p className="text-xs text-text-tertiary">
                    Профиль браузера существует. Нажмите «Открыть браузер и YouTube», чтобы запустить его снова.
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Sources List */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Все источники
            </h4>

            {loading && (
              <p className="text-xs text-text-tertiary py-4 text-center">Загрузка...</p>
            )}

            {!loading && (!summary?.allSources || summary.allSources.length === 0) && (
              <div className="text-center py-8">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="mx-auto mb-2 text-text-tertiary/50"
                >
                  <path
                    d="M9 12h6M12 9v6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
                <p className="text-sm text-text-tertiary">Нет источников cookies</p>
                <p className="text-xs text-text-tertiary mt-1">
                  Загрузите cookies.txt или настройте браузерную сессию.
                </p>
              </div>
            )}

            {!loading &&
              summary?.allSources?.map((source) => (
                <SourceRow
                  key={source.id}
                  source={source}
                  onActivate={handleActivate}
                  onValidate={handleValidate}
                  onDelete={(id) => {
                    if (id === activeSourceId) {
                      setDeleteConfirm(id)
                    } else {
                      handleDelete(id)
                    }
                  }}
                  isActive={source.id === activeSourceId}
                />
              ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Удалить активный источник?"
        message="Этот источник сейчас активен. После удаления будет использован файл из YT_COOKIES_FILE (если настроен) или cookies отключатся."
        confirmLabel="Удалить"
        onConfirm={() => {
          if (deleteConfirm) handleDelete(deleteConfirm)
          setDeleteConfirm(null)
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </Drawer>
  )
}