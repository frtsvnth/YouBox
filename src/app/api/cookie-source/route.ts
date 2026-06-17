import { getSessionId, validateSession } from '@/lib/auth'
import {
  getCookieSourceSummary,
  deleteSource,
} from '@/lib/cookie-source'
import { errorResponse, NotFoundError } from '@/lib/errors'

export async function GET(): Promise<Response> {
  const sessionId = await getSessionId()
  if (!sessionId || !validateSession(sessionId)) {
    return Response.json({ error: 'unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
  }

  const summary = getCookieSourceSummary()
  return Response.json(summary)
}

export async function DELETE(request: Request): Promise<Response> {
  const sessionId = await getSessionId()
  if (!sessionId || !validateSession(sessionId)) {
    return Response.json({ error: 'unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
  }

  try {
    const { id } = await request.json() as { id: string }
    if (!id) {
      return Response.json({ error: 'id обязателен', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    const deleted = deleteSource(id)
    if (!deleted) throw new NotFoundError('Источник cookies')

    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}