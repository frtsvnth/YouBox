import { getDb } from './db'
import { env } from './env'

export interface LockoutStatus {
  locked: boolean
  remainingAttempts: number
  lockoutUntil: number | null
}

export function checkLockout(): LockoutStatus {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - env.LOGIN_LOCKOUT_DURATION

  db.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').run(windowStart)

  const row = db.prepare(
    'SELECT COUNT(*) as count FROM login_attempts WHERE attempted_at > ?',
  ).get(windowStart) as { count: number }

  if (row.count >= env.LOGIN_MAX_ATTEMPTS) {
    const oldest = db.prepare(
      'SELECT attempted_at FROM login_attempts ORDER BY attempted_at ASC LIMIT 1',
    ).get() as { attempted_at: number } | undefined

    const lockoutUntil = oldest
      ? oldest.attempted_at + env.LOGIN_LOCKOUT_DURATION
      : now + env.LOGIN_LOCKOUT_DURATION

    if (now < lockoutUntil) {
      return { locked: true, remainingAttempts: 0, lockoutUntil }
    }

    db.prepare('DELETE FROM login_attempts').run()
    return { locked: false, remainingAttempts: env.LOGIN_MAX_ATTEMPTS, lockoutUntil: null }
  }

  return {
    locked: false,
    remainingAttempts: Math.max(0, env.LOGIN_MAX_ATTEMPTS - row.count),
    lockoutUntil: null,
  }
}

export function recordFailedAttempt(): void {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  db.prepare('INSERT INTO login_attempts (attempted_at) VALUES (?)').run(now)
}

export function clearAttempts(): void {
  const db = getDb()
  db.prepare('DELETE FROM login_attempts').run()
}
