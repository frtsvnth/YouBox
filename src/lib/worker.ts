import { getDb } from './db'
import { env } from './env'
import { extractMetadata, downloadFile, cleanupJobFiles } from './downloader'
import { getFileSize } from './muxer'
import { cleanupExpiredFiles, cleanupStaleJobs } from './cleanup'
import { cleanupExpiredSessions } from './auth'
import { YtDlpError } from './errors'
import path from 'node:path'
import type { Job } from '@/types'

let workerInterval: ReturnType<typeof setInterval> | null = null
let isProcessing = false
const LOG_PREFIX = '[worker]'

function log(...args: unknown[]) {
  if (env.LOG_LEVEL === 'debug' || env.LOG_LEVEL === 'info') {
    console.log(LOG_PREFIX, ...args)
  }
}

function now(): number {
  return Math.floor(Date.now() / 1000)
}

async function processNextJob(): Promise<void> {
  if (isProcessing) return
  isProcessing = true
  try {
    const db = getDb()
    const t = now()

    const created = db.prepare("SELECT * FROM jobs WHERE status = 'created' LIMIT 1").get() as Job | undefined
    if (created) {
      log(`extracting ${created.id}`)
      db.prepare('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?').run('extracting', t, created.id)
      try {
        const info = await extractMetadata(created.url)
        db.prepare(
          'UPDATE jobs SET status = ?, title = ?, updated_at = ? WHERE id = ?',
        ).run('queued', info.title, t, created.id)
        log(`queued ${created.id}: "${info.title}"`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const userMsg = err instanceof YtDlpError ? err.userMessage : msg
        db.prepare(
          'UPDATE jobs SET status = ?, error_message = ?, updated_at = ? WHERE id = ?',
        ).run('failed', userMsg, t, created.id)
        log(`failed ${created.id}: ${msg}`)
      }
      return
    }

    const queued = db.prepare("SELECT * FROM jobs WHERE status = 'queued' LIMIT 1").get() as Job | undefined
    if (queued) {
      log(`downloading ${queued.id}`)
      db.prepare('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?').run('downloading', t, queued.id)
      try {
        const result = await downloadFile({
          url: queued.url,
          jobId: queued.id,
          format: queued.format,
          mode: queued.mode ?? 'video',
          formatId: queued.format_id ?? undefined,
          onProgress: (pct) => {
            db.prepare('UPDATE jobs SET progress = ?, updated_at = ? WHERE id = ?').run(pct, t, queued.id)
          },
        })

        const readyAt = now()
        const expiresAt = readyAt + env.FILE_TTL
        const filePath = path.join(env.DOWNLOADS_DIR(), result.filename)
        const filesize = getFileSize(filePath)

        db.prepare(
          `UPDATE jobs SET status = ?, filename = ?, filesize = ?, progress = ?,
           ready_at = ?, expires_at = ?, playlist_index = ?, playlist_size = ?,
           updated_at = ? WHERE id = ?`,
        ).run(
          'ready', result.filename, filesize, 100,
          readyAt, expiresAt, result.playlistIndex, result.playlistSize,
          t, queued.id,
        )
        log(`ready ${queued.id}: ${result.filename} (${filesize} bytes)`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const userMsg = err instanceof YtDlpError ? err.userMessage : msg
        cleanupJobFiles(queued.id)
        db.prepare(
          'UPDATE jobs SET status = ?, error_message = ?, updated_at = ? WHERE id = ?',
        ).run('failed', userMsg, t, queued.id)
        log(`failed ${queued.id}: ${msg}`)
      }
      return
    }
  } finally {
    isProcessing = false
  }
}

export function startWorker(): void {
  log('starting background worker')
  cleanupStaleJobs()

  workerInterval = setInterval(async () => {
    try {
      cleanupExpiredFiles()
      cleanupExpiredSessions()
      cleanupStaleJobs()
      await processNextJob()
    } catch (err) {
      console.error(`${LOG_PREFIX} error in worker loop:`, err)
    }
  }, 3000)
}

export function stopWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval)
    workerInterval = null
  }
  log('worker stopped')
}
