import { getSessionId, validateSession } from '@/lib/auth'
import { activateSource, getSourceById } from '@/lib/cookie-source'
import { errorResponse, NotFoundError } from '@/lib/errors'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const sessionId = await getSessionId()
  if (!sessionId || !validateSession(sessionId)) {
    return Response.json({ error: 'unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
  }

  try {
    const { id } = await params
    const source = getSourceById(id)
    if (!source) throw new NotFoundError('Источник cookies')

    const result = activateSource(id)
    if (!result) {
      return Response.json(
        { error: 'Не удалось активировать источник. Проверьте его статус.', code: 'ACTIVATION_FAILED' },
        { status: 400 },
      )
    }

    return Response.json({ ok: true, source: result })
  } catch (err) {
    return errorResponse(err)
  }
}