import { clearSessionCookie, getSessionId, deleteSession } from '@/lib/auth'

export async function POST(): Promise<Response> {
  const sessionId = await getSessionId()
  if (sessionId) {
    deleteSession(sessionId)
  }
  await clearSessionCookie()
  return Response.json({ ok: true })
}
