import { getSessionId, validateSession } from '@/lib/auth'

export async function GET() {
  const sessionId = await getSessionId()
  if (!sessionId || !validateSession(sessionId)) {
    return Response.json({ authenticated: false }, { status: 401 })
  }
  return Response.json({ authenticated: true })
}
