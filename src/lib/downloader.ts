import { runSubprocess, buildArgs } from './subprocess'
import { env } from './env'
import { YtDlpError, mapYtDlpError, BinaryNotFoundError } from './errors'
import { pushLog } from './logger'
import fs from 'node:fs'
import path from 'node:path'
import type { ExtractedMetadata, FormatInfo, ExtractedEntry, OutputFormat, DownloadMode } from '@/types'

const SENSITIVE_FLAGS = new Set(['--cookies'])

const JS_RT_ARGS = ['--js-runtimes', 'node', '--remote-components', 'ejs:github']
const OAUTH2_ARGS = ['--username', 'oauth2', '--password', '']
const CACHE_DIR = '/data/.cache/yt-dlp'

const COOKIES_TMP = '/tmp/youbox-cookies.txt'

function cookiesArgs(): string[] {
  if (env.YT_COOKIES_FILE && fs.existsSync(env.YT_COOKIES_FILE)) {
    try {
      fs.copyFileSync(env.YT_COOKIES_FILE, COOKIES_TMP)
      fs.chmodSync(COOKIES_TMP, 0o666)
    } catch {
      return ['--cookies', env.YT_COOKIES_FILE]
    }
    return ['--cookies', COOKIES_TMP]
  }
  return []
}

function findSensitiveIndices(args: string[]): number[] {
  return args.reduce<number[]>((acc, arg, i) => {
    if (SENSITIVE_FLAGS.has(arg) && i + 1 < args.length) {
      acc.push(i + 1)
    }
    return acc
  }, [])
}

function playlistLimitArgs(mode: DownloadMode): string[] {
  if (mode !== 'playlist') return ['--no-playlist']
  return ['--flat-playlist', '--playlist-end', String(env.PLAYLIST_MAX_ITEMS)]
}

function formatArgs(format: OutputFormat): string[] {
  switch (format) {
    case 'mp3':
      return ['-x', '--audio-format', 'mp3', '--audio-quality', '0']
    case 'webm':
      return ['-f', 'bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]', '--merge-output-format', 'webm']
    case 'mp4':
    default:
      return ['-f', 'bestvideo+bestaudio/best', '--merge-output-format', 'mp4']
  }
}

function parseFormats(rawFormats: unknown[]): FormatInfo[] {
  return (rawFormats || []).map((f) => {
    const r = f as Record<string, unknown>
    return {
      format_id: String(r.format_id ?? ''),
      ext: String(r.ext ?? ''),
      resolution: r.resolution ? String(r.resolution) : null,
      filesize: typeof r.filesize === 'number' ? r.filesize : null,
      format_note: r.format_note ? String(r.format_note) : null,
      vcodec: String(r.vcodec ?? 'none'),
      acodec: String(r.acodec ?? 'none'),
      fps: typeof r.fps === 'number' ? r.fps : null,
      tbr: typeof r.tbr === 'number' ? r.tbr : null,
    }
  })
}

function parseEntries(rawEntries: unknown[]): ExtractedEntry[] {
  return (rawEntries || []).slice(0, env.PLAYLIST_MAX_ITEMS).map((e) => {
    const r = e as Record<string, unknown>
    return {
      id: String(r.id ?? ''),
      title: String(r.title ?? r.display_id ?? 'Unknown'),
      duration: typeof r.duration === 'number' ? r.duration : null,
      url: String(r.webpage_url ?? r.url ?? r.id ?? ''),
      thumbnail: r.thumbnail ? String(r.thumbnail) : null,
    }
  })
}

function parseSingleInfo(raw: Record<string, unknown>, originalUrl: string): ExtractedMetadata {
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? 'Unknown'),
    duration: typeof raw.duration === 'number' ? raw.duration : null,
    webpage_url: String(raw.webpage_url ?? originalUrl),
    thumbnail: raw.thumbnail ? String(raw.thumbnail) : null,
    uploader: raw.uploader ? String(raw.uploader) : null,
    upload_date: raw.upload_date ? String(raw.upload_date) : null,
    formats: parseFormats(raw.formats as unknown[]),
    is_playlist: false,
    playlist_count: null,
    entries: null,
    extractor: String(raw.extractor ?? 'generic'),
    extractor_key: String(raw.extractor_key ?? 'Generic'),
  }
}

function parsePlaylistInfo(raw: Record<string, unknown>, originalUrl: string): ExtractedMetadata {
  const entries = parseEntries(raw.entries as unknown[])

  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? 'Playlist'),
    duration: null,
    webpage_url: String(raw.webpage_url ?? originalUrl),
    thumbnail: raw.thumbnail ? String(raw.thumbnail) : null,
    uploader: raw.uploader ? String(raw.uploader) : null,
    upload_date: null,
    formats: [],
    is_playlist: true,
    playlist_count: typeof raw.playlist_count === 'number' ? raw.playlist_count : entries.length,
    entries: entries.length > 0 ? entries : null,
    extractor: String(raw.extractor ?? 'generic'),
    extractor_key: String(raw.extractor_key ?? 'Generic'),
  }
}

export async function extractMetadata(url: string): Promise<ExtractedMetadata> {
  pushLog('info', 'yt-dlp', `извлечение метаданных: ${url}`)
  const args = buildArgs(
    ['--dump-json', '--no-download', '--no-warnings', '--ignore-errors'],
    {},
  )
  args.push(...cookiesArgs(), ...OAUTH2_ARGS, '--cache-dir', CACHE_DIR, ...JS_RT_ARGS, url)

  const sensitiveIndices = findSensitiveIndices(args)

  let result
  try {
    result = await runSubprocess({
      bin: 'yt-dlp',
      args,
      timeout: 30000,
      sensitiveArgIndices: sensitiveIndices,
    })
  } catch (err) {
    if (err instanceof Error && err.message.includes('binary not found')) {
      throw new BinaryNotFoundError('yt-dlp')
    }
    throw err
  }

  if (result.exitCode !== 0) {
    throw new YtDlpError(result.stderr, mapYtDlpError(result.stderr), result.stderr)
  }

  const lines = result.stdout.trim().split('\n').filter(Boolean)
  if (lines.length === 0) {
    throw new YtDlpError('Empty output from yt-dlp', 'Не удалось получить информацию о видео')
  }

  const raw = JSON.parse(lines[0]) as Record<string, unknown>

  if (raw._type === 'playlist' || raw.is_playlist || raw.entries) {
    if (lines.length > 1) {
      const playlistInfo = JSON.parse(lines[0]) as Record<string, unknown>
      return parsePlaylistInfo(playlistInfo, url)
    }
    return parsePlaylistInfo(raw, url)
  }

  return parseSingleInfo(raw, url)
}

export interface DownloadOptions {
  url: string
  jobId: string
  format: OutputFormat
  mode: DownloadMode
  formatId?: string
  onProgress?: (percent: number) => void
  onProgressDetail?: (detail: ProgressDetail) => void
  onStageChange?: (stage: string) => void
}

export interface ProgressDetail {
  percent: number
  downloadedBytes: number | null
  totalBytes: number | null
  speed: number | null
  etaSeconds: number | null
}

export interface DownloadResult {
  outputPath: string
  filename: string
  title: string
  playlistIndex: number | null
  playlistSize: number | null
}

export async function downloadFile(options: DownloadOptions): Promise<DownloadResult> {
  const { url, jobId, format, mode, formatId, onProgress, onProgressDetail, onStageChange } = options

  const tmpDir = path.join(env.TMP_DIR(), jobId)
  fs.mkdirSync(tmpDir, { recursive: true })

  const outputTemplate = path.join(tmpDir, '%(title).100s_%(id)s.%(ext)s')
  const args: string[] = []

  args.push('--no-warnings')
  args.push(...playlistLimitArgs(mode))
  args.push(...cookiesArgs(), ...OAUTH2_ARGS, '--cache-dir', CACHE_DIR, ...JS_RT_ARGS)

  if (formatId) {
    args.push('-f', formatId)
    if (format === 'mp3') {
      args.push('-x', '--audio-format', 'mp3')
    } else {
      args.push('--merge-output-format', format === 'webm' ? 'webm' : 'mp4')
    }
  } else {
    args.push(...formatArgs(format))
  }

  args.push('--newline')
  args.push('-o', outputTemplate, url)

  const sensitiveIndices = findSensitiveIndices(args)

  pushLog('info', 'yt-dlp', `скачивание ${jobId}: ${url} (${format})`)

  let result
  try {
    result = await runSubprocess({
      bin: 'yt-dlp',
      args,
      timeout: 600_000,
      sensitiveArgIndices: sensitiveIndices,
      onStderrLine: (line) => {
        if (line.includes('[youtube]') || line.includes('[info]') || line.includes('ERROR')) {
          pushLog('debug', 'yt-dlp', `${jobId}: ${line}`)
        }
        parseProgressLine(line, onProgress, onProgressDetail, onStageChange)
      },
    })
  } catch (err) {
    pushLog('error', 'yt-dlp', `ошибка ${jobId}: ${err instanceof Error ? err.message : String(err)}`)
    if (err instanceof Error && err.message.includes('binary not found')) {
      throw new BinaryNotFoundError('yt-dlp')
    }
    throw err
  }

  if (result.exitCode !== 0) {
    pushLog('error', 'yt-dlp', `exit code ${result.exitCode} для ${jobId}: ${result.stderr.slice(0, 200)}`)
    throw new YtDlpError(result.stderr, mapYtDlpError(result.stderr), result.stderr)
  }

  pushLog('info', 'yt-dlp', `завершено ${jobId}`)

  const downloadPath = parseDownloadPath(result.stderr, tmpDir)
  if (!downloadPath) {
    const files = fs.readdirSync(tmpDir).filter((f) => f !== '.' && f !== '..')
    if (files.length > 0) {
      const fullPath = path.join(tmpDir, files[0])
      const destName = moveToDownloads(jobId, fullPath, env.DOWNLOADS_DIR())
      cleanupJobFiles(jobId)

      let playlistIndex: number | null = null
      let playlistSize: number | null = null
      if (mode === 'playlist') {
        playlistIndex = 1
        playlistSize = env.PLAYLIST_MAX_ITEMS
      }

      return {
        outputPath: path.join(env.DOWNLOADS_DIR(), destName),
        filename: destName,
        title: path.basename(fullPath, path.extname(fullPath)),
        playlistIndex,
        playlistSize,
      }
    }
    throw new YtDlpError('Output file not found after download', 'Файл не найден после скачивания')
  }

  if (!fs.existsSync(downloadPath)) {
    const files = fs.readdirSync(tmpDir).filter((f) => f !== '.' && f !== '..')
    if (files.length > 0) {
      const fullPath = path.join(tmpDir, files[0])
      const destName = moveToDownloads(jobId, fullPath, env.DOWNLOADS_DIR())
      cleanupJobFiles(jobId)

      let playlistIndex: number | null = null
      let playlistSize: number | null = null
      if (mode === 'playlist') {
        playlistIndex = 1
        playlistSize = env.PLAYLIST_MAX_ITEMS
      }

      return {
        outputPath: path.join(env.DOWNLOADS_DIR(), destName),
        filename: destName,
        title: path.basename(fullPath, path.extname(fullPath)),
        playlistIndex,
        playlistSize,
      }
    }
    throw new YtDlpError('Output file not found after download', 'Файл не найден после скачивания')
  }

  const destName = moveToDownloads(jobId, downloadPath, env.DOWNLOADS_DIR())
  cleanupJobFiles(jobId)

  let playlistIndex: number | null = null
  let playlistSize: number | null = null
  if (mode === 'playlist') {
    playlistIndex = 1
    playlistSize = env.PLAYLIST_MAX_ITEMS
  }

  return {
    outputPath: path.join(env.DOWNLOADS_DIR(), destName),
    filename: destName,
    title: path.basename(downloadPath, path.extname(downloadPath)),
    playlistIndex,
    playlistSize,
  }
}

export function moveToDownloads(jobId: string, sourcePath: string, downloadDir: string): string {
  fs.mkdirSync(downloadDir, { recursive: true })
  const ext = path.extname(sourcePath)
  const destName = `${jobId}${ext}`
  const destPath = path.join(downloadDir, destName)
  fs.copyFileSync(sourcePath, destPath)
  return destName
}

export function cleanupJobFiles(jobId: string): void {
  const tmpDir = path.join(env.TMP_DIR(), jobId)
  try {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  } catch {
    /* ignore */
  }
}

const PROGRESS_RE = /^\[download\]\s+(\d+\.?\d*)%\s*(?:of\s+~?([\d.]+[GMK]iB|[\d.]+)?)?\s*(?:at\s+([\d.]+[GMK]iB\/s))?\s*(?:ETA\s+((?:\d+:)?\d+:\d+))?/
const EXTRACT_RE = /^\[ExtractAudio\]/
const MUX_RE = /^\[Muxer\]|^\[Merger\]/

function parseProgressLine(
  line: string,
  onProgress?: (percent: number) => void,
  onProgressDetail?: (detail: ProgressDetail) => void,
  onStageChange?: (stage: string) => void,
): void {
  if (!onProgress && !onProgressDetail && !onStageChange) return

  if (EXTRACT_RE.test(line) && onStageChange) {
    onStageChange('muxing')
    return
  }
  if (MUX_RE.test(line) && onStageChange) {
    onStageChange('muxing')
    return
  }

  const match = line.match(PROGRESS_RE)
  if (!match) return

  const percent = parseFloat(match[1])

  if (onProgress) onProgress(percent)

  if (!onProgressDetail) return

  const totalStr = match[2]
  const speedStr = match[3]
  const etaStr = match[4]

  let totalBytes: number | null = null
  if (totalStr) totalBytes = parseSize(totalStr)

  let speed: number | null = null
  if (speedStr) speed = parseSize(speedStr.replace(/\/s$/, ''))

  let etaSeconds: number | null = null
  if (etaStr) {
    const parts = etaStr.split(':').map(Number)
    if (parts.length === 3) {
      etaSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
    } else if (parts.length === 2) {
      etaSeconds = parts[0] * 60 + parts[1]
    }
  }

  const downloadedBytes = totalBytes !== null ? Math.round(totalBytes * percent / 100) : null

  onProgressDetail({ percent, downloadedBytes, totalBytes, speed, etaSeconds })
}

function parseSize(sizeStr: string): number | null {
  const match = sizeStr.match(/^([\d.]+)\s*([GMK]iB)?$/)
  if (!match) return null

  const num = parseFloat(match[1])
  const unit = match[2]

  switch (unit) {
    case 'GiB': return Math.round(num * 1024 * 1024 * 1024)
    case 'MiB': return Math.round(num * 1024 * 1024)
    case 'KiB': return Math.round(num * 1024)
    default: return Math.round(num)
  }
}

export function formatSpeed(bytesPerSec: number | null): string {
  if (bytesPerSec === null) return ''
  if (bytesPerSec >= 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(1)} GiB/s`
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MiB/s`
  if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(0)} KiB/s`
  return `${bytesPerSec} B/s`
}

export function formatEta(seconds: number | null): string {
  if (seconds === null) return ''
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const DEST_RE = /\[download\] Destination:\s+(.+)/i
const MERGE_RE = /\[Merger\] Merging formats into\s+"([^"]+)"/i

function parseDownloadPath(stderr: string, _tmpDir: string): string | null {
  const mergeMatch = stderr.match(MERGE_RE)
  if (mergeMatch) return mergeMatch[1]

  let lastDest: string | null = null
  let match: RegExpExecArray | null
  const re = new RegExp(DEST_RE.source, 'gi')
  while ((match = re.exec(stderr)) !== null) {
    lastDest = match[1]
  }
  if (lastDest && !lastDest.includes('.f')) return lastDest

  if (lastDest) {
    const basePath = lastDest.replace(/\.f\d+\b/, '')
    const ext = path.extname(basePath)
    const base = basePath.slice(0, -ext.length)
    for (const candidate of [basePath, `${base}.mp4`, `${base}.webm`, `${base}.mkv`]) {
      if (fs.existsSync(candidate)) return candidate
    }
  }

  return null
}
