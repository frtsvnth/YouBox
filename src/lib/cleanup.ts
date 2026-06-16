import { getDb } from './db'
import { env } from './env'
import { pushLog } from './logger'
import fs from 'node:fs'
import path from 'node:path'

export function cleanupExpiredFiles(): number {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const expired = db
    .prepare("SELECT id, filename FROM jobs WHERE status = 'ready' AND expires_at IS NOT NULL AND expires_at < ?")
    .all(now) as { id: string; filename: string | null }[]

  let count = 0
  for (const job of expired) {
    if (job.filename) {
      const filePath = path.join(env.DOWNLOADS_DIR(), job.filename)
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      } catch { /* ignore */ }
    }
    db.prepare('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?').run('expired', now, job.id)
    count++
  }

  if (count > 0) pushLog('info', 'cleanup', `просрочено ${count} файлов`)

  return count
}

export function cleanupStaleJobs(): number {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const staleThreshold = now - 300

  const stale = db
    .prepare("SELECT id FROM jobs WHERE status IN ('extracting','downloading','muxing') AND updated_at < ?")
    .all(staleThreshold) as { id: string }[]

  for (const job of stale) {
    const tmpDir = path.join(env.TMP_DIR(), job.id)
    try {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch { /* ignore */ }
    db.prepare('UPDATE jobs SET status = ?, error_message = ?, updated_at = ? WHERE id = ?').run(
      'failed',
      'timeout',
      now,
      job.id
    )
  }

  if (stale.length > 0) pushLog('warn', 'cleanup', `зависших задач: ${stale.length}`)

  return stale.length
}
