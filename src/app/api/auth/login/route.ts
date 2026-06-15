import { verifyPin, createSession, setSessionCookie } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { checkLockout, recordFailedAttempt, clearAttempts } from '@/lib/lockout'
import { errorResponse, RateLimitError, LockoutError } from '@/lib/errors'
import type { LoginResponse } from '@/types'

export async function POST(request: Request): Promise<Response> {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    if (!checkRateLimit(`login:${ip}`, 10, 60_000)) {
      throw new RateLimitError()
    }

    const lockout = checkLockout()
    if (lockout.locked) {
      throw new LockoutError(lockout.lockoutUntil!)
    }

    const body = await request.json()
    const { pin } = body

    if (typeof pin !== 'string' || pin.length === 0) {
      return Response.json(
        { error: 'PIN обязателен', code: 'VALIDATION_ERROR', remainingAttempts: lockout.remainingAttempts },
        { status: 400 },
      )
    }

    if (!verifyPin(pin)) {
      recordFailedAttempt()
      const updatedLockout = checkLockout()
      const responseBody: LoginResponse = {
        ok: false,
        remainingAttempts: updatedLockout.remainingAttempts,
        lockoutUntil: updatedLockout.lockoutUntil,
      }
      return Response.json(responseBody, { status: 401 })
    }

    clearAttempts()
    const sessionId = createSession()
    await setSessionCookie(sessionId)

    return Response.json({ ok: true } satisfies LoginResponse)
  } catch (err) {
    return errorResponse(err)
  }
}
