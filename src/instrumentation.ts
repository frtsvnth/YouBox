export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('@/lib/env')
    validateEnv()

    const { initCookieSources } = await import('@/lib/cookie-source')
    initCookieSources()

    const { startWorker } = await import('@/lib/worker')
    startWorker()
  }
}
