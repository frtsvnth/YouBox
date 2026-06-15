import { getSessionId, validateSession } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { cleanupJobFiles } from '@/lib/downloader'

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
  const row = db
    .prepare("SELECT status FROM jobs WHERE id = ? AND status IN ('failed','expired')")
    .get(id) as { status: string } | undefined

  if (!row) {
    return Response.json(
      { error: 'Задача не найдена или не может быть повторена', code: 'INVALID_STATE' },
      { status: 400 },
    )
  }

  cleanupJobFiles(id)

  const t = Math.floor(Date.now() / 1000)
  db.prepare(
    `UPDATE jobs SET status = 'created', progress = 0, progress_downloaded = NULL,
     progress_total = NULL, progress_speed = NULL, progress_eta = NULL,
     current_stage = '', error_message = NULL, updated_at = ? WHERE id = ?`,
  ).run(t, id)

  return Response.json({ ok: true })
}
