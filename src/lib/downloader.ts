import { runSubprocess, buildArgs } from './subprocess'
import { env } from './env'
import { YtDlpError, mapYtDlpError, BinaryNotFoundError } from './errors'
import fs from 'node:fs'
import path from 'node:path'
import type { ExtractedMetadata, FormatInfo, ExtractedEntry, OutputFormat, DownloadMode } from '@/types'

const SENSITIVE_FLAGS = new Set(['--cookies'])

function cookiesArgs(): string[] {
  if (env.YT_COOKIES_FILE && fs.existsSync(env.YT_COOKIES_FILE)) {
    return ['--cookies', env.YT_COOKIES_FILE]
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
      return ['-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', '--merge-output-format', 'mp4']
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
  const args = buildArgs(
    ['--dump-json', '--no-download', '--no-warnings', '--ignore-errors'],
    {},
  )
  args.push(...cookiesArgs(), url)

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
}

export interface DownloadResult {
  outputPath: string
  filename: string
  title: string
  playlistIndex: number | null
  playlistSize: number | null
}

export async function downloadFile(options: DownloadOptions): Promise<DownloadResult> {
  const { url, jobId, format, mode, formatId } = options

  const tmpDir = path.join(env.TMP_DIR(), jobId)
  fs.mkdirSync(tmpDir, { recursive: true })

  const outputTemplate = path.join(tmpDir, '%(title).100s_%(id)s.%(ext)s')
  const args: string[] = []

  args.push('--print', 'filename')
  args.push('--print', 'title')
  args.push('--no-warnings')
  args.push(...playlistLimitArgs(mode))
  args.push(...cookiesArgs())

  if (formatId) {
    args.push('-f', `${formatId}+bestaudio/best`)
  } else {
    args.push(...formatArgs(format))
  }

  args.push('-o', outputTemplate, url)

  const sensitiveIndices = findSensitiveIndices(args)

  let result
  try {
    result = await runSubprocess({
      bin: 'yt-dlp',
      args,
      timeout: 600_000,
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

  const outputFilename = lines[0] ?? ''
  const title = lines[1] ?? 'Unknown'

  if (!outputFilename) {
    throw new YtDlpError('No output filename from yt-dlp', 'Не удалось определить имя файла')
  }

  const sourcePath = path.join(tmpDir, path.basename(outputFilename))

  if (!fs.existsSync(sourcePath)) {
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
        title,
        playlistIndex,
        playlistSize,
      }
    }
    throw new YtDlpError('Output file not found after download', 'Файл не найден после скачивания')
  }

  const destName = moveToDownloads(jobId, sourcePath, env.DOWNLOADS_DIR())
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
    title,
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
