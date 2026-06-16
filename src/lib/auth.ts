import crypto from 'node:crypto'
import { getDb } from './db'
import { env } from './env'
import { cookies } from 'next/headers'
import { v4 as uuid } from 'uuid'
import type { SessionResponse } from '@/types'

const SESSION_COOKIE = 'youbox-session'

function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function verifyPin(provided: string): boolean {
  const providedHash = hashString(provided)

  if (env.APP_PIN_HASH) {
    return crypto.timingSafeEqual(
      Buffer.from(providedHash),
      Buffer.from(env.APP_PIN_HASH),
    )
  }

  if (env.AUTH_PIN) {
    return hashString(env.AUTH_PIN) === providedHash
  }

  return false
}

export function createSession(): string {
  const db = getDb()
  const id = uuid()
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + env.SESSION_TTL
  db.prepare('INSERT INTO sessions (id, created_at, expires_at) VALUES (?, ?, ?)').run(id, now, expiresAt)
  return id
}

export function validateSession(sessionId: string): boolean {
  const db = getDb()
  const row = db.prepare('SELECT expires_at FROM sessions WHERE id = ?').get(sessionId) as
    | { expires_at: number }
    | undefined
  if (!row) return false
  const now = Math.floor(Date.now() / 1000)
  if (now > row.expires_at) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
    return false
  }
  return true
}

export function deleteSession(sessionId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
}

export function cleanupExpiredSessions(): void {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now)
}

export async function getSessionId(): Promise<string | null> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value ?? null
}

export async function setSessionCookie(sessionId: string): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: env.SESSION_TTL,
    secure: env.COOKIE_SECURE,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function requireSession(): Promise<string> {
  const sessionId = await getSessionId()
  if (!sessionId || !validateSession(sessionId)) {
    throw new Error('unauthorized')
  }
  return sessionId
}

export function getSessionInfo(sessionId: string): SessionResponse | null {
  const db = getDb()
  const row = db.prepare(
    'SELECT id, created_at, expires_at FROM sessions WHERE id = ?',
  ).get(sessionId) as { id: string; created_at: number; expires_at: number } | undefined

  if (!row) return null

  const now = Math.floor(Date.now() / 1000)
  return {
    authenticated: now <= row.expires_at,
    sessionId: row.id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }
}
