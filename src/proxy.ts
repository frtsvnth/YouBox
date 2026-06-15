import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const publicPaths = [
  '/api/auth/login',
  '/api/auth/session',
  '/api/health',
  '/login',
]

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') ?? '127.0.0.1'
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  request.headers.set('x-real-ip', getClientIp(request))

  if (
    publicPaths.some((p) => pathname === p) ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const sessionId = request.cookies.get('youbox-session')?.value

  if (!sessionId) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}
