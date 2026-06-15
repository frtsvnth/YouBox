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
    .prepare("SELECT status FROM jobs WHERE id = ? AND status IN ('queued','downloading')")
    .get(id) as { status: string } | undefined

  if (!row) {
    return Response.json(
      { error: 'Задача не найдена или не может быть отменена', code: 'INVALID_STATE' },
      { status: 400 },
    )
  }

  const t = Math.floor(Date.now() / 1000)
  cleanupJobFiles(id)
  db.prepare('UPDATE jobs SET status = ?, error_message = ?, updated_at = ? WHERE id = ?').run(
    'failed',
    'отменено пользователем',
    t,
    id,
  )

  return Response.json({ ok: true })
}
