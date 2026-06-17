import { getDb } from './db'
import { env } from './env'
import fs from 'node:fs'
import path from 'node:path'
import { v4 as uuid } from 'uuid'
import type { CookieSource, CookieSourceType, CookieSourceSummary } from '@/types'
import { pushLog } from './logger'
import { runSubprocess } from './subprocess'

const COOKIES_TMP = '/tmp/youbox-cookies.txt'

// ─── Validation ───────────────────────────────────────────

export function looksLikeNetscapeCookies(content: string): boolean {
  const lines = content.split('\n').filter(l => {
    const trimmed = l.trim()
    return trimmed !== '' && !trimmed.startsWith('#')
  })
  if (lines.length === 0) return false
  const firstLine = lines[0].trim()
  const parts = firstLine.split('\t')
  return parts.length >= 6 || content.includes('.youtube.com') || content.includes('.google.com')
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).size > 0
  } catch {
    return false
  }
}

// ─── CRUD ─────────────────────────────────────────────────

export function getAllSources(): CookieSource[] {
  const db = getDb()
  return db.prepare(
    'SELECT * FROM cookie_sources ORDER BY created_at DESC',
  ).all() as CookieSource[]
}

export function getSourceById(id: string): CookieSource | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM cookie_sources WHERE id = ?').get(id) as CookieSource | undefined
}

export function getActiveSource(): CookieSource | undefined {
  const db = getDb()
  return db.prepare("SELECT * FROM cookie_sources WHERE status = 'active' LIMIT 1").get() as
    | CookieSource
    | undefined
}

export function addUploadedSource(filePath: string): CookieSource {
  const db = getDb()
  const id = uuid()
  const now = Math.floor(Date.now() / 1000)
  const sourceType: CookieSourceType = 'uploaded_file'

  db.prepare(
    `INSERT INTO cookie_sources (id, source_type, status, file_path, uploaded_at, validated_at, created_at, updated_at)
     VALUES (?, ?, 'active', ?, ?, ?, ?, ?)`,
  ).run(id, sourceType, filePath, now, now, now, now)

  deactivateOthers(id)
  pushLog('info', 'cookie-source', `добавлен источник cookies (upload): ${id}`)
  return getSourceById(id)!
}

export function addBrowserSource(filePath: string | null): CookieSource {
  const db = getDb()
  const id = uuid()
  const now = Math.floor(Date.now() / 1000)
  const sourceType: CookieSourceType = 'browser_session'

  db.prepare(
    `INSERT INTO cookie_sources (id, source_type, status, file_path, exported_at, created_at, updated_at)
     VALUES (?, ?, 'disabled', ?, ?, ?, ?)`,
  ).run(id, sourceType, filePath, now, now, now)

  pushLog('info', 'cookie-source', `добавлен источник cookies (browser): ${id}`)
  return getSourceById(id)!
}

export function activateSource(id: string): CookieSource | null {
  const db = getDb()
  const source = getSourceById(id)
  if (!source) return null
  if (source.status === 'missing' || source.status === 'invalid') {
    updateSource(id, { error_message: 'Нельзя активировать: источник недоступен или невалиден' })
    return null
  }

  deactivateOthers(id)
  const now = Math.floor(Date.now() / 1000)
  db.prepare('UPDATE cookie_sources SET status = ?, updated_at = ? WHERE id = ?').run('active', now, id)
  pushLog('info', 'cookie-source', `активирован источник cookies: ${id} (${source.source_type})`)
  return getSourceById(id)!
}

function deactivateOthers(exceptId: string): void {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  db.prepare("UPDATE cookie_sources SET status = 'disabled', updated_at = ? WHERE status = 'active' AND id != ?").run(
    now,
    exceptId,
  )
}

export function deleteSource(id: string): boolean {
  const db = getDb()
  const source = getSourceById(id)
  if (!source) return false

  const wasActive = source.status === 'active'

  if (source.file_path && fs.existsSync(source.file_path)) {
    try {
      fs.unlinkSync(source.file_path)
    } catch { /* ignore */ }
  }

  db.prepare('DELETE FROM cookie_sources WHERE id = ?').run(id)
  pushLog('info', 'cookie-source', `удалён источник cookies: ${id}`)

  if (wasActive) {
    tryFallbackToEnvSource()
  }

  return true
}

function updateSource(id: string, fields: Partial<CookieSource>): void {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const allowed = ['status', 'file_path', 'validated_at', 'exported_at', 'error_message', 'notes']
  for (const key of allowed) {
    if (key in fields) {
      const val = (fields as Record<string, unknown>)[key]
      db.prepare(`UPDATE cookie_sources SET ${key} = ?, updated_at = ? WHERE id = ?`).run(
        val ?? null,
        now,
        id,
      )
    }
  }
  db.prepare('UPDATE cookie_sources SET updated_at = ? WHERE id = ?').run(now, id)
}

// ─── Validation ───────────────────────────────────────────

export function validateSource(id: string): { valid: boolean; error?: string } {
  const source = getSourceById(id)
  if (!source) return { valid: false, error: 'Источник не найден' }

  if (!source.file_path || !fileExists(source.file_path)) {
    updateSource(id, { status: 'missing', validated_at: Math.floor(Date.now() / 1000), error_message: 'Файл не найден на диске' })
    return { valid: false, error: 'Файл не найден' }
  }

  try {
    const content = fs.readFileSync(source.file_path, 'utf-8')
    if (!looksLikeNetscapeCookies(content)) {
      updateSource(id, { status: 'invalid', validated_at: Math.floor(Date.now() / 1000), error_message: 'Формат файла не распознан как Netscape cookies' })
      return { valid: false, error: 'Неверный формат файла cookies' }
    }
  } catch (err) {
    updateSource(id, { status: 'invalid', validated_at: Math.floor(Date.now() / 1000), error_message: `Ошибка чтения файла: ${err instanceof Error ? err.message : String(err)}` })
    return { valid: false, error: 'Ошибка чтения файла' }
  }

  updateSource(id, { validated_at: Math.floor(Date.now() / 1000), error_message: null })
  return { valid: true }
}

// ─── Resolve cookies for downloader ───────────────────────

export function getResolvedCookiePath(): string | null {
  const active = getActiveSource()
  if (active && active.file_path && fileExists(active.file_path)) {
    try {
      fs.copyFileSync(active.file_path, COOKIES_TMP)
      fs.chmodSync(COOKIES_TMP, 0o600)
      return COOKIES_TMP
    } catch {
      return active.file_path
    }
  }

  if (active && active.status === 'active') {
    updateSource(active.id, { status: 'missing', error_message: 'Файл cookies не найден на диске' })
  }

  if (env.YT_COOKIES_FILE && fileExists(env.YT_COOKIES_FILE)) {
    try {
      fs.copyFileSync(env.YT_COOKIES_FILE, COOKIES_TMP)
      fs.chmodSync(COOKIES_TMP, 0o600)
      return COOKIES_TMP
    } catch {
      return env.YT_COOKIES_FILE
    }
  }

  return null
}

function tryFallbackToEnvSource(): void {
  if (env.YT_COOKIES_FILE && fileExists(env.YT_COOKIES_FILE)) {
    pushLog('info', 'cookie-source', 'активный источник удалён, используется YT_COOKIES_FILE из env')
  } else {
    pushLog('warn', 'cookie-source', 'активный источник удалён, cookies не настроены')
  }
}

// ─── Browser sidecar communication ────────────────────────

export interface BrowserStatus {
  running: boolean
  profileExists: boolean
  profilePath: string | null
  browserUrl: string | null
  error: string | null
}

export async function getBrowserStatus(): Promise<BrowserStatus> {
  if (!env.ENABLE_BROWSER_COOKIE_SOURCE || !env.BROWSER_COOKIE_SERVICE_URL) {
    return { running: false, profileExists: false, profilePath: null, browserUrl: null, error: null }
  }

  try {
    const res = await fetch(`${env.BROWSER_COOKIE_SERVICE_URL}/status`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      return { running: false, profileExists: false, profilePath: null, browserUrl: null, error: `HTTP ${res.status}` }
    }
    return await res.json()
  } catch (err) {
    return {
      running: false,
      profileExists: false,
      profilePath: null,
      browserUrl: null,
      error: err instanceof Error ? err.message : 'Connection failed',
    }
  }
}

export async function openBrowserSession(): Promise<{ ok: boolean; error?: string }> {
  if (!env.ENABLE_BROWSER_COOKIE_SOURCE || !env.BROWSER_COOKIE_SERVICE_URL) {
    return { ok: false, error: 'Browser source не включён' }
  }

  try {
    const statusRes = await fetch(`${env.BROWSER_COOKIE_SERVICE_URL}/status`, {
      signal: AbortSignal.timeout(5000),
    })
    const status = await statusRes.json()

    if (status.running) {
      await fetch(`${env.BROWSER_COOKIE_SERVICE_URL}/open-youtube`, {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
      })
      return { ok: true }
    }

    const startRes = await fetch(`${env.BROWSER_COOKIE_SERVICE_URL}/open-youtube`, {
      method: 'POST',
      signal: AbortSignal.timeout(20000),
    })
    const data = await startRes.json()
    return { ok: data.ok, error: data.error }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' }
  }
}

export async function exportBrowserCookies(): Promise<{ success: boolean; filePath: string | null; error?: string }> {
  if (!env.ENABLE_BROWSER_COOKIE_SOURCE || !env.BROWSER_COOKIE_SERVICE_URL) {
    return { success: false, filePath: null, error: 'Browser source не включён' }
  }

  try {
    const cookiesDir = env.COOKIES_DIR()
    fs.mkdirSync(cookiesDir, { recursive: true })

    const res = await fetch(`${env.BROWSER_COOKIE_SERVICE_URL}/export`, {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, filePath: null, error: text || `HTTP ${res.status}` }
    }

    const exportPath = env.BROWSER_COOKIE_EXPORT_PATH
      ? env.BROWSER_COOKIE_EXPORT_PATH
      : path.join(cookiesDir, 'browser-exported-cookies.txt')

    const content = await res.text()
    const tmpPath = exportPath + '.tmp'
    fs.writeFileSync(tmpPath, content, 'utf-8')
    fs.chmodSync(tmpPath, 0o600)
    fs.renameSync(tmpPath, exportPath)

    return { success: true, filePath: exportPath }
  } catch (err) {
    return { success: false, filePath: null, error: err instanceof Error ? err.message : 'Export failed' }
  }
}

export function storeBrowserExport(filePath: string): CookieSource {
  const existing = getExistingBrowserSources()

  let source: CookieSource

  if (existing.length > 0) {
    source = existing[0]
    const now = Math.floor(Date.now() / 1000)
    const db = getDb()
    db.prepare(
      'UPDATE cookie_sources SET file_path = ?, exported_at = ?, status = ?, error_message = NULL, updated_at = ? WHERE id = ?',
    ).run(filePath, now, 'active', now, source.id)
    deactivateOthers(source.id)
    source = getSourceById(source.id)!
  } else {
    source = addBrowserSource(filePath)
    activateSource(source.id)
    source = getSourceById(source.id)!
  }

  pushLog('info', 'cookie-source', `экспорт cookies browser сохранён: ${source.id}`)
  return source
}

function getExistingBrowserSources(): CookieSource[] {
  const db = getDb()
  return db
    .prepare("SELECT * FROM cookie_sources WHERE source_type = 'browser_session' ORDER BY created_at DESC")
    .all() as CookieSource[]
}

// ─── Summary ──────────────────────────────────────────────

export function getCookieSourceSummary(): CookieSourceSummary {
  const allSources = getAllSources()
  const activeSource = allSources.find((s) => s.status === 'active') ?? null

  return {
    activeSource,
    allSources,
    browserEnabled: env.ENABLE_BROWSER_COOKIE_SOURCE,
    browserAvailable: false,
    browserUrl: null,
  }
}

// ─── Upload handling ──────────────────────────────────────

export function storeUploadedFile(content: string, originalName: string): { id: string; filePath: string } {
  const cookiesDir = env.UPLOADED_COOKIES_PATH
    ? path.dirname(env.UPLOADED_COOKIES_PATH)
    : env.COOKIES_DIR()
  fs.mkdirSync(cookiesDir, { recursive: true })

  const safeName = `uploaded-${Date.now()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const filePath = env.UPLOADED_COOKIES_PATH
    ? env.UPLOADED_COOKIES_PATH
    : path.join(cookiesDir, safeName)

  fs.writeFileSync(filePath, content, 'utf-8')
  fs.chmodSync(filePath, 0o600)

  const source = addUploadedSource(filePath)
  return { id: source.id, filePath }
}

// ─── Init: auto-setup default source from env ─────────────

export function initCookieSources(): void {
  const db = getDb()
  const count = (
    db.prepare('SELECT COUNT(*) as count FROM cookie_sources').get() as { count: number }
  ).count

  if (count > 0) return

  if (env.YT_COOKIES_FILE && fileExists(env.YT_COOKIES_FILE)) {
    const source = addUploadedSource(env.YT_COOKIES_FILE)
    validateSource(source.id)
    pushLog('info', 'cookie-source', 'автоматически создан источник из YT_COOKIES_FILE')
  }
}

// ─── Cookie validation via yt-dlp ─────────────────────────

export async function validateCookiesViaDownload(path: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const result = await runSubprocess({
      bin: 'yt-dlp',
      args: [
        '--cookies', path,
        '--js-runtimes', 'node',
        '--remote-components', 'ejs:github',
        '--no-warnings',
        '--dump-json',
        '--no-download',
        'https://www.youtube.com',
        '--playlist-items', '1',
        '--flat-playlist',
        '--no-check-certificate',
      ],
      timeout: 15000,
      sensitiveArgIndices: [1],
    })

    if (result.exitCode !== 0) {
      return { valid: false, error: result.stderr.slice(0, 200) }
    }
    return { valid: true }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Validation failed' }
  }
}