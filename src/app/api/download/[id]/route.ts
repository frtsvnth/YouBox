import { getDb } from '@/lib/db'
import { getSessionId, validateSession } from '@/lib/auth'
import { env } from '@/lib/env'
import { safeDownloadFilename } from '@/lib/filename'
import fs from 'node:fs'
import path from 'node:path'
import type { Job } from '@/types'

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
    return Response.json(
      { error: 'Файл не готов или не найден', code: 'NOT_FOUND' },
      { status: 404 },
    )
  }

  const filePath = path.join(env.DOWNLOADS_DIR(), job.filename)
  if (!fs.existsSync(filePath)) {
    return Response.json(
      { error: 'Файл не найден на диске', code: 'FILE_NOT_FOUND' },
      { status: 404 },
    )
  }

  const stat = fs.statSync(filePath)
  const ext = path.extname(job.filename)

  const contentTypeMap: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.webm': 'video/webm',
    '.mp4': 'video/mp4',
    '.m4a': 'audio/mp4',
    '.mkv': 'video/x-matroska',
  }
  const contentType = contentTypeMap[ext] ?? 'application/octet-stream'

  const fileBuffer = fs.readFileSync(filePath)
  const downloadName = safeDownloadFilename(job.title, ext)
  const asciiFallback = downloadName.replace(/[^\x20-\x7E]/g, '_')

  return new Response(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      'Content-Length': String(stat.size),
    },
  })
}
