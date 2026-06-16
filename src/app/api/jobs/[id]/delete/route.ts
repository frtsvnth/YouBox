import { getSessionId, validateSession } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { cleanupJobFiles } from '@/lib/downloader'
import { env } from '@/lib/env'
import fs from 'node:fs'
import path from 'node:path'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const sessionId = await getSessionId()
  if (!sessionId || !validateSession(sessionId)) {
    return Response.json({ error: 'unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
  }

  const { id } = await params
  const db = getDb()

  const row = db.prepare('SELECT filename FROM jobs WHERE id = ?').get(id) as { filename: string | null } | undefined
  if (!row) {
    return Response.json({ error: 'Задача не найдена', code: 'NOT_FOUND' }, { status: 404 })
  }

  cleanupJobFiles(id)

  if (row.filename) {
    const filePath = path.join(env.DOWNLOADS_DIR(), row.filename)
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch { /* ignore */ }
  }

  db.prepare('DELETE FROM jobs WHERE id = ?').run(id)

  return Response.json({ ok: true })
}
