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

export type YtDlpErrorCode =
  | 'BOT_CHECK'
  | 'NO_FORMATS'
  | 'CLIENT_BLOCKED'
  | 'AGE_RESTRICTED'
  | 'PRIVATE'
  | 'UNAVAILABLE'
  | 'HTTP_ERROR'
  | 'PLAYLIST_LIMIT'
  | 'UNKNOWN'

// Коды, которые означают, что нужны свежие cookies / другой источник авторизации.
// Их читают ротация источников (cookie-source) и планировщик авто-переэкспорта.
export const AUTH_ERROR_CODES: readonly YtDlpErrorCode[] = [
  'BOT_CHECK',
  'NO_FORMATS',
  'CLIENT_BLOCKED',
]

export function isAuthError(code: YtDlpErrorCode | undefined | null): boolean {
  return code != null && AUTH_ERROR_CODES.includes(code)
}

export class YtDlpError extends AppError {
  public readonly rawStderr: string
  public readonly errorCode: YtDlpErrorCode

  constructor(
    message: string,
    userMessage: string,
    rawStderr?: string,
    errorCode: YtDlpErrorCode = 'UNKNOWN',
  ) {
    super(message, userMessage, 422, 'YT_DLP_ERROR')
    this.name = 'YtDlpError'
    this.rawStderr = rawStderr ?? message
    this.errorCode = errorCode
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

interface ErrorPattern {
  pattern: string
  message: string
  code: YtDlpErrorCode
}

// Порядок важен: более специфичные паттерны идут раньше общих.
const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: "Sign in to confirm you're not a bot",
    message: 'YouTube требует подтверждения. Обновите cookies или включите PO Token.',
    code: 'BOT_CHECK',
  },
  {
    pattern: 'No video formats found',
    message: 'Форматы не найдены — вероятно, устарели cookies или нужен PO Token.',
    code: 'NO_FORMATS',
  },
  {
    pattern: 'The following content is not available on this app',
    message: 'YouTube заблокировал клиент — обновите yt-dlp и/или cookies.',
    code: 'CLIENT_BLOCKED',
  },
  {
    pattern: 'Sign in to confirm your age',
    message: 'Требуется подтверждение возраста. Используйте cookies файл.',
    code: 'AGE_RESTRICTED',
  },
  { pattern: 'Private video', message: 'Видео является приватным', code: 'PRIVATE' },
  { pattern: 'This video is private', message: 'Видео является приватным', code: 'PRIVATE' },
  { pattern: 'Video unavailable', message: 'Видео недоступно', code: 'UNAVAILABLE' },
  { pattern: 'This video is unavailable', message: 'Видео недоступно', code: 'UNAVAILABLE' },
  { pattern: 'HTTP Error 403', message: 'Доступ запрещён. Возможно, требуется cookies файл.', code: 'HTTP_ERROR' },
  { pattern: 'HTTP Error 404', message: 'Видео не найдено. Проверьте ссылку.', code: 'HTTP_ERROR' },
  {
    pattern: 'playlist',
    message: 'Плейлист содержит больше элементов, чем разрешено настройками.',
    code: 'PLAYLIST_LIMIT',
  },
]

export interface ClassifiedYtDlpError {
  userMessage: string
  code: YtDlpErrorCode
}

export function classifyYtDlpError(stderr: string): ClassifiedYtDlpError {
  for (const { pattern, message, code } of ERROR_PATTERNS) {
    if (stderr.includes(pattern)) return { userMessage: message, code }
  }
  if (stderr.includes('HTTP Error')) {
    return { userMessage: 'Ошибка при загрузке. Проверьте ссылку и cookies файл.', code: 'HTTP_ERROR' }
  }
  if (stderr.includes('ERROR:')) {
    const match = stderr.match(/ERROR:\s*(.+)/)
    if (match) return { userMessage: match[1].trim(), code: 'UNKNOWN' }
  }
  return { userMessage: 'Ошибка при обработке видео. Проверьте ссылку.', code: 'UNKNOWN' }
}

export function mapYtDlpError(stderr: string): string {
  return classifyYtDlpError(stderr).userMessage
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
