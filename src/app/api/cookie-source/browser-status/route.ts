import { getSessionId, validateSession } from '@/lib/auth'
import { getBrowserStatus } from '@/lib/cookie-source'

export async function GET(): Promise<Response> {
  const sessionId = await getSessionId()
  if (!sessionId || !validateSession(sessionId)) {
    return Response.json({ error: 'unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
  }

  const status = await getBrowserStatus()
  return Response.json(status)
}