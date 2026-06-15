import { getDb } from '@/lib/db'
import { getSessionId, validateSession } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { errorResponse, ValidationError, RateLimitError, ConflictError } from '@/lib/errors'
import { v4 as uuid } from 'uuid'
import type { Job, OutputFormat, CreateJobRequest } from '@/types'

const VALID_FORMATS: OutputFormat[] = ['mp4', 'mp3', 'webm']

export async function GET(request: Request): Promise<Response> {
  const sessionId = await getSessionId()
  if (!sessionId || !validateSession(sessionId)) {
    return Response.json({ error: 'unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status') ?? 'active'
  const db = getDb()

  let jobs: Job[]
  if (statusFilter === 'all') {
    jobs = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50').all() as Job[]
  } else {
    jobs = db
      .prepare("SELECT * FROM jobs WHERE status NOT IN ('expired') ORDER BY created_at DESC LIMIT 50")
      .all() as Job[]
  }

  return Response.json({ jobs })
}

export async function POST(request: Request): Promise<Response> {
  try {
    const sessionId = await getSessionId()
    if (!sessionId || !validateSession(sessionId)) {
      return Response.json({ error: 'unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
    }

    if (!checkRateLimit(`submit:${sessionId}`, 5, 60_000)) {
      throw new RateLimitError()
    }

    const body = (await request.json()) as Partial<CreateJobRequest>
    const { url, format, mode = 'video', format_id } = body

    if (!url || typeof url !== 'string') {
      throw new ValidationError('URL is required', 'URL обязателен для создания задачи')
    }

    const outputFormat: OutputFormat = format && VALID_FORMATS.includes(format) ? format : 'mp4'

    try {
      new URL(url)
    } catch {
      throw new ValidationError('Invalid URL', 'Некорректный URL. Проверьте ссылку.')
    }

    const db = getDb()
    const existing = db
      .prepare("SELECT id FROM jobs WHERE url = ? AND status NOT IN ('ready','failed','expired')")
      .get(url) as Pick<Job, 'id'> | undefined

    if (existing) {
      throw new ConflictError('Это видео уже в очереди', { id: existing.id })
    }

    const id = uuid()
    const t = Math.floor(Date.now() / 1000)

    db.prepare(
      `INSERT INTO jobs (id, url, format, mode, format_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'created', ?, ?)`,
    ).run(id, url, outputFormat, mode, format_id ?? null, t, t)

    return Response.json({ id, status: 'created' }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
