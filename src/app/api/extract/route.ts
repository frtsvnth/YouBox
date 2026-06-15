import { getSessionId, validateSession } from '@/lib/auth'
import { extractMetadata } from '@/lib/downloader'
import { checkRateLimit } from '@/lib/rate-limit'
import { errorResponse, RateLimitError, ValidationError } from '@/lib/errors'
import type { ExtractResponse } from '@/types'

export async function POST(request: Request): Promise<Response> {
  try {
    const sessionId = await getSessionId()
    if (!sessionId || !validateSession(sessionId)) {
      return Response.json({ error: 'unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
    }

    if (!checkRateLimit(`extract:${sessionId}`, 10, 60_000)) {
      throw new RateLimitError()
    }

    const body = await request.json()
    const { url } = body as { url?: string }

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      throw new ValidationError('URL is required', 'URL обязателен для извлечения метаданных')
    }

    try {
      new URL(url)
    } catch {
      throw new ValidationError('Invalid URL', 'Некорректный URL. Проверьте ссылку.')
    }

    const metadata = await extractMetadata(url.trim())

    return Response.json({ metadata } satisfies ExtractResponse)
  } catch (err) {
    return errorResponse(err)
  }
}
