import { getSessionId, validateSession } from '@/lib/auth'
import { getLogs, clearLogs } from '@/lib/logger'

export async function GET(request: Request): Promise<Response> {
  const sessionId = await getSessionId()
  if (!sessionId || !validateSession(sessionId)) {
    return Response.json({ error: 'unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
  }

  const url = new URL(request.url)
  const afterId = parseInt(url.searchParams.get('after') || '0', 10) || 0

  return Response.json(getLogs(afterId))
}

export async function POST(): Promise<Response> {
  const sessionId = await getSessionId()
  if (!sessionId || !validateSession(sessionId)) {
    return Response.json({ error: 'unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
  }

  clearLogs()
  return Response.json({ ok: true })
}
