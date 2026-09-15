import { getDb } from '@/lib/db'
import { getSessionId, validateSession } from '@/lib/auth'
import { env } from '@/lib/env'
import { runSubprocess } from '@/lib/subprocess'
import fs from 'node:fs'
import path from 'node:path'
import type { Job } from '@/types'

const DEFAULT_FPS = 30

function parseFrameRate(value: string | undefined): number | null {
  if (!value) return null
  const [num, den] = value.split('/').map(Number)
  if (!num || !den) return null
  const fps = num / den
  return Number.isFinite(fps) && fps > 0 ? fps : null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const sessionId = await getSessionId()
  if (!sessionId || !validateSession(sessionId)) {
    return Response.json({ error: 'unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
  }

  const { id } = await params
  const db = getDb()
  const job = db
    .prepare("SELECT * FROM jobs WHERE id = ? AND status = 'ready'")
    .get(id) as Job | undefined

  if (!job || !job.filename) {
    return Response.json({ error: 'Файл не готов или не найден', code: 'NOT_FOUND' }, { status: 404 })
  }

  const filePath = path.join(env.DOWNLOADS_DIR(), job.filename)
  if (!fs.existsSync(filePath)) {
    return Response.json({ error: 'Файл не найден на диске', code: 'FILE_NOT_FOUND' }, { status: 404 })
  }

  try {
    const result = await runSubprocess({
      bin: 'ffprobe',
      args: [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=r_frame_rate,avg_frame_rate,width,height:format=duration',
        '-of', 'json',
        filePath,
      ],
      timeout: 15000,
    })

    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || 'ffprobe failed')
    }

    const data = JSON.parse(result.stdout) as {
      streams?: { r_frame_rate?: string; avg_frame_rate?: string; width?: number; height?: number }[]
      format?: { duration?: string }
    }
    const stream = data.streams?.[0]
    const fps = parseFrameRate(stream?.avg_frame_rate) ?? parseFrameRate(stream?.r_frame_rate) ?? DEFAULT_FPS
    const duration = data.format?.duration ? parseFloat(data.format.duration) : null

    return Response.json({
      fps,
      duration,
      width: stream?.width ?? null,
      height: stream?.height ?? null,
    })
  } catch {
    return Response.json({ fps: DEFAULT_FPS, duration: null, width: null, height: null })
  }
}
