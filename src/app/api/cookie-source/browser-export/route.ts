import { getSessionId, validateSession } from '@/lib/auth'
import {
  exportBrowserCookies,
  storeBrowserExport,
  validateSource,
} from '@/lib/cookie-source'
import { errorResponse } from '@/lib/errors'

export async function POST(): Promise<Response> {
  const sessionId = await getSessionId()
  if (!sessionId || !validateSession(sessionId)) {
    return Response.json({ error: 'unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
  }

  try {
    const exportResult = await exportBrowserCookies()

    if (!exportResult.success || !exportResult.filePath) {
      return Response.json(
        { error: exportResult.error ?? 'Ошибка экспорта cookies', code: 'EXPORT_FAILED' },
        { status: 502 },
      )
    }

    const source = storeBrowserExport(exportResult.filePath)

    const validation = validateSource(source.id)

    return Response.json({
      ok: true,
      sourceId: source.id,
      sourceType: 'browser_session',
      validated: validation.valid,
      error: validation.error ?? null,
    })
  } catch (err) {
    return errorResponse(err)
  }
}