import { getSessionId, validateSession } from '@/lib/auth'
import { storeUploadedFile, validateSource, activateSource } from '@/lib/cookie-source'
import { errorResponse, ValidationError } from '@/lib/errors'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(request: Request): Promise<Response> {
  const sessionId = await getSessionId()
  if (!sessionId || !validateSession(sessionId)) {
    return Response.json({ error: 'unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      throw new ValidationError('File is required', 'Файл cookies обязателен')
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError(
        'File too large',
        'Файл слишком большой. Максимальный размер: 10MB',
      )
    }

    if (!file.name.endsWith('.txt')) {
      throw new ValidationError(
        'Invalid file type',
        'Файл должен быть в формате .txt',
      )
    }

    const content = await file.text()

    if (content.length === 0) {
      throw new ValidationError('Empty file', 'Файл пуст')
    }

    const { id } = storeUploadedFile(content, file.name)

    const validation = validateSource(id)

    if (!validation.valid) {
      await activateSource(id)
    }

    return Response.json({
      id,
      filePath: null,
      sourceType: 'uploaded_file',
      validated: validation.valid,
      error: validation.error ?? null,
    })
  } catch (err) {
    return errorResponse(err)
  }
}