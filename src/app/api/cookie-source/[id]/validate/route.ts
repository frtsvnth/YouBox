import { getSessionId, validateSession } from '@/lib/auth'
import { validateSource, getSourceById, validateCookiesViaDownload } from '@/lib/cookie-source'
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

    const basic = validateSource(id)
    if (!basic.valid) {
      return Response.json({ valid: false, error: basic.error, deep: false })
    }

    let deep: { valid: boolean; error?: string } | null = null
    if (source.file_path) {
      deep = await validateCookiesViaDownload(source.file_path)
    }

    return Response.json({
      valid: deep?.valid ?? basic.valid,
      error: deep?.error ?? basic.error ?? null,
      deep: deep !== null,
    })
  } catch (err) {
    return errorResponse(err)
  }
}