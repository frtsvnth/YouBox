import { env } from './env'
import { getDb } from './db'
import { runSubprocess } from './subprocess'
import fs from 'node:fs'
import type { HealthStatus } from '@/types'

async function checkBinary(bin: string): Promise<{ available: boolean; version: string | null }> {
  try {
    const result = await runSubprocess({ bin, args: ['--version'], timeout: 5000 })
    const version = result.stdout.trim().split('\n')[0] || null
    return { available: result.exitCode === 0, version }
  } catch {
    return { available: false, version: null }
  }
}

export async function getHealth(): Promise<HealthStatus> {
  const [ytDlp, ffmpeg] = await Promise.all([
    checkBinary('yt-dlp'),
    checkBinary('ffmpeg'),
  ])

  let dbAvailable = false
  let jobCount = 0
  try {
    const db = getDb()
    const row = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number }
    jobCount = row.count
    dbAvailable = true
  } catch {
    dbAvailable = false
  }

  const cookiesFile = env.YT_COOKIES_FILE
    ? { available: fs.existsSync(env.YT_COOKIES_FILE), path: env.YT_COOKIES_FILE }
    : { available: false, path: null }

  const allOk = ytDlp.available && ffmpeg.available && dbAvailable
  const cookiesConfigured = env.YT_COOKIES_FILE !== null
  const cookiesMissing = cookiesConfigured && !cookiesFile.available
  const criticalFail = !dbAvailable

  return {
    status: criticalFail ? 'error' : (cookiesMissing || !allOk) ? 'degraded' : 'ok',
    app: { uptime: Math.floor(Date.now() / 1000) - env.UPTIME() },
    ytDlp,
    ffmpeg,
    cookiesFile,
    database: { available: dbAvailable, jobCount },
  }
}
