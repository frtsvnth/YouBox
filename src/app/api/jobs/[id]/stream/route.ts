import { getDb } from '@/lib/db'
import { getSessionId, validateSession } from '@/lib/auth'
import { env } from '@/lib/env'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import type { Job } from '@/types'

const CONTENT_TYPE_MAP: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
}

export async function GET(
  request: Request,
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

  const ext = path.extname(job.filename).toLowerCase()
  const contentType = CONTENT_TYPE_MAP[ext]
  if (!contentType) {
    return Response.json({ error: 'Просмотр недоступен для этого формата', code: 'UNSUPPORTED_FORMAT' }, { status: 400 })
  }

  const filePath = path.join(env.DOWNLOADS_DIR(), job.filename)
  if (!fs.existsSync(filePath)) {
    return Response.json({ error: 'Файл не найден на диске', code: 'FILE_NOT_FOUND' }, { status: 404 })
  }

  const size = fs.statSync(filePath).size
  const range = request.headers.get('range')

  if (!range) {
    const stream = Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream
    return new Response(stream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes',
      },
    })
  }

  const match = /bytes=(\d*)-(\d*)/.exec(range)
  if (!match) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }

  const start = match[1] ? parseInt(match[1], 10) : 0
  const end = match[2] ? parseInt(match[2], 10) : size - 1

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= size) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }

  const stream = Readable.toWeb(fs.createReadStream(filePath, { start, end })) as ReadableStream
  return new Response(stream, {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
    },
  })
}
