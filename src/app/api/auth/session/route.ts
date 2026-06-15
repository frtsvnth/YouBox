import { getSessionId, validateSession, getSessionInfo } from '@/lib/auth'
import type { SessionResponse } from '@/types'

export async function GET(): Promise<Response> {
  const sessionId = await getSessionId()
  if (!sessionId || !validateSession(sessionId)) {
    return Response.json({ authenticated: false } satisfies SessionResponse)
  }

  const info = getSessionInfo(sessionId) ?? { authenticated: true, sessionId }
  return Response.json(info)
}
