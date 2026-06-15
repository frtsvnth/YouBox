export class AppError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'INTERNAL_ERROR',
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, userMessage: string) {
    super(message, userMessage, 400, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class AuthError extends AppError {
  constructor(userMessage?: string) {
    super(
      'Authentication failed',
      userMessage ?? 'Ошибка авторизации',
      401,
      'AUTH_ERROR',
    )
    this.name = 'AuthError'
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super('Rate limit exceeded', 'Слишком много запросов. Попробуйте позже.', 429, 'RATE_LIMIT_ERROR')
    this.name = 'RateLimitError'
  }
}

export class LockoutError extends AppError {
  constructor(public readonly until: number) {
    super(
      'Account locked',
      'Аккаунт временно заблокирован из-за множества неудачных попыток входа.',
      429,
      'LOCKOUT_ERROR',
    )
    this.name = 'LockoutError'
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super(`${entity} not found`, `${entity} не найден`, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(userMessage: string, public readonly extra?: Record<string, unknown>) {
    super(userMessage, userMessage, 409, 'CONFLICT')
    this.name = 'ConflictError'
  }
}

export class YtDlpError extends AppError {
  public readonly rawStderr: string

  constructor(message: string, userMessage: string, rawStderr?: string) {
    super(message, userMessage, 422, 'YT_DLP_ERROR')
    this.name = 'YtDlpError'
    this.rawStderr = rawStderr ?? message
  }
}

export class BinaryNotFoundError extends AppError {
  constructor(binary: string) {
    super(
      `${binary} not found`,
      `${binary} не найден в системе. Проверьте установку.`,
      503,
      'BINARY_NOT_FOUND',
    )
    this.name = 'BinaryNotFoundError'
  }
}

const USER_FRIENDLY_MAP: Record<string, string> = {
  'Video unavailable': 'Видео недоступно',
  'Private video': 'Видео является приватным',
  'This video is private': 'Видео является приватным',
  'This video is unavailable': 'Видео недоступно',
  'Sign in to confirm your age': 'Требуется подтверждение возраста. Используйте cookies файл.',
  'HTTP Error 403': 'Доступ запрещён. Возможно, требуется cookies файл.',
  'HTTP Error 404': 'Видео не найдено. Проверьте ссылку.',
  'playlist': 'Плейлист содержит больше элементов, чем разрешено настройками.',
}

export function mapYtDlpError(stderr: string): string {
  for (const [pattern, message] of Object.entries(USER_FRIENDLY_MAP)) {
    if (stderr.includes(pattern)) return message
  }
  if (stderr.includes('HTTP Error')) return 'Ошибка при загрузке. Проверьте ссылку и cookies файл.'
  if (stderr.includes('ERROR:')) {
    const match = stderr.match(/ERROR:\s*(.+)/)
    if (match) return match[1].trim()
  }
  return 'Ошибка при обработке видео. Проверьте ссылку.'
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      { error: err.userMessage, code: err.code },
      { status: err.statusCode },
    )
  }

  const message = err instanceof Error ? err.message : String(err)
  console.error('[unhandled]', message)
  return Response.json(
    { error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' },
    { status: 500 },
  )
}
