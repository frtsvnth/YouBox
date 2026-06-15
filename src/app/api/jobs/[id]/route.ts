import { getDb } from '@/lib/db'
import { getSessionId, validateSession } from '@/lib/auth'
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
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Job | undefined

  if (!job) {
    return Response.json({ error: 'Задача не найдена', code: 'NOT_FOUND' }, { status: 404 })
  }

  return Response.json({ job })
}
