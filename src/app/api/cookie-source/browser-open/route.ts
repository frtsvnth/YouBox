import { getSessionId, validateSession } from '@/lib/auth'
import { openBrowserSession } from '@/lib/cookie-source'
import { errorResponse } from '@/lib/errors'

export async function POST(): Promise<Response> {
  const sessionId = await getSessionId()
  if (!sessionId || !validateSession(sessionId)) {
    return Response.json({ error: 'unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
  }

  try {
    const result = await openBrowserSession()
    if (!result.ok) {
      return Response.json({ error: result.error ?? 'Не удалось запустить браузер', code: 'BROWSER_ERROR' }, { status: 502 })
    }
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}