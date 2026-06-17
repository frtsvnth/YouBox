function strEnv(key: string, fallback?: string): string {
  const val = process.env[key]
  if (!val && fallback === undefined) throw new Error(`Missing required env: ${key}`)
  return val ?? fallback!
}

function intEnv(key: string, fallback: number): number {
  const val = process.env[key]
  if (!val) return fallback
  const n = parseInt(val, 10)
  if (isNaN(n)) return fallback
  return n
}

const _startTime = Math.floor(Date.now() / 1000)

export const env = {
  AUTH_PIN: process.env.AUTH_PIN ?? null,
  APP_PIN_HASH: process.env.APP_PIN_HASH ?? null,
  DATA_DIR: strEnv('DATA_DIR', './data'),
  COOKIE_SECURE: process.env.COOKIE_SECURE !== 'false',
  SESSION_TTL: intEnv('SESSION_TTL', 86400),
  FILE_TTL: intEnv('FILE_TTL', 7200),
  PORT: intEnv('PORT', 3007),
  APP_BASE_URL: process.env.APP_BASE_URL ?? null,
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  YT_COOKIES_FILE: process.env.YT_COOKIES_FILE ?? null,
  PLAYLIST_MAX_ITEMS: intEnv('PLAYLIST_MAX_ITEMS', 10),
  LOGIN_MAX_ATTEMPTS: intEnv('LOGIN_MAX_ATTEMPTS', 5),
  LOGIN_LOCKOUT_DURATION: intEnv('LOGIN_LOCKOUT_DURATION', 300),
  ENABLE_BROWSER_COOKIE_SOURCE: process.env.ENABLE_BROWSER_COOKIE_SOURCE === 'true',
  DEFAULT_COOKIE_SOURCE: (process.env.DEFAULT_COOKIE_SOURCE as 'uploaded_file' | 'browser_session') ?? 'uploaded_file',
  UPLOADED_COOKIES_PATH: process.env.UPLOADED_COOKIES_PATH ?? null,
  BROWSER_COOKIE_SERVICE_URL: process.env.BROWSER_COOKIE_SERVICE_URL ?? null,
  BROWSER_COOKIE_EXPORT_PATH: process.env.BROWSER_COOKIE_EXPORT_PATH ?? null,
  DB_PATH: () => `${env.DATA_DIR}/db/youbox.db`,
  DOWNLOADS_DIR: () => `${env.DATA_DIR}/downloads`,
  TMP_DIR: () => `${env.DATA_DIR}/tmp`,
  COOKIES_DIR: () => `${env.DATA_DIR}/cookies`,
  UPTIME: () => _startTime,
} as const

export function validateEnv(): void {
  if (!process.env.DATA_DIR) throw new Error('Missing required env: DATA_DIR')
  if (!process.env.APP_PIN_HASH && !process.env.AUTH_PIN) {
    throw new Error('Missing required env: APP_PIN_HASH or AUTH_PIN')
  }
}
