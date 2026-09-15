import { env } from './env'
import { pushLog } from './logger'
import { upsertAccountCookieSource, validateSource, ensureSomeActiveSource } from './cookie-source'
import fs from 'node:fs'
import path from 'node:path'

export interface AccountRefreshResult {
  account: string
  ok: boolean
  at: number
  error: string | null
}

interface RefreshStatus {
  enabled: boolean
  lastRunAt: number | null
  lastSuccessAt: number | null
  accounts: AccountRefreshResult[]
}

declare global {
  var __youbox_cookie_refresh: {
    interval: ReturnType<typeof setInterval> | null
    isRefreshing: boolean
    status: RefreshStatus
  } | undefined
}

function getState() {
  if (!globalThis.__youbox_cookie_refresh) {
    globalThis.__youbox_cookie_refresh = {
      interval: null,
      isRefreshing: false,
      status: {
        enabled: false,
        lastRunAt: null,
        lastSuccessAt: null,
        accounts: [],
      },
    }
  }
  return globalThis.__youbox_cookie_refresh
}

export function getLastRefreshStatus(): RefreshStatus {
  return getState().status
}

function isEnabled(): boolean {
  return env.ENABLE_COOKIE_AUTO_REFRESH && !!env.BROWSER_COOKIE_SERVICE_URL
}

async function fetchAccounts(): Promise<string[]> {
  const res = await fetch(`${env.BROWSER_COOKIE_SERVICE_URL}/accounts`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`/accounts HTTP ${res.status}`)
  const data = (await res.json()) as { accounts?: string[] }
  return data.accounts ?? []
}

async function refreshAccount(account: string): Promise<AccountRefreshResult> {
  const at = Math.floor(Date.now() / 1000)
  try {
    const res = await fetch(`${env.BROWSER_COOKIE_SERVICE_URL}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account }),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) {
      const text = await res.text()
      return { account, ok: false, at, error: text.slice(0, 300) || `HTTP ${res.status}` }
    }

    const content = await res.text()
    const cookiesDir = env.COOKIES_DIR()
    fs.mkdirSync(cookiesDir, { recursive: true })
    const filePath = path.join(cookiesDir, `browser-${account}.txt`)
    const tmpPath = filePath + '.tmp'
    fs.writeFileSync(tmpPath, content, 'utf-8')
    fs.chmodSync(tmpPath, 0o600)
    fs.renameSync(tmpPath, filePath)

    const source = upsertAccountCookieSource(account, filePath)
    validateSource(source.id)

    return { account, ok: true, at, error: null }
  } catch (err) {
    return { account, ok: false, at, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function refreshAll(): Promise<void> {
  const state = getState()
  if (!isEnabled() || state.isRefreshing) return
  state.isRefreshing = true
  state.status.lastRunAt = Math.floor(Date.now() / 1000)

  try {
    const accounts = await fetchAccounts()
    if (accounts.length === 0) {
      pushLog('warn', 'cookie-refresh', 'sidecar не вернул ни одного аккаунта')
      state.status.accounts = []
      return
    }

    const results: AccountRefreshResult[] = []
    for (const account of accounts) {
      const result = await refreshAccount(account)
      results.push(result)
      if (result.ok) {
        pushLog('info', 'cookie-refresh', `cookies обновлены: ${account}`)
      } else {
        pushLog('error', 'cookie-refresh', `не удалось обновить ${account}: ${result.error}`)
      }
    }

    state.status.accounts = results
    if (results.some((r) => r.ok)) {
      state.status.lastSuccessAt = Math.floor(Date.now() / 1000)
      ensureSomeActiveSource()
    }
  } catch (err) {
    pushLog('error', 'cookie-refresh', `ошибка планировщика: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    state.isRefreshing = false
  }
}

export function startCookieRefresh(): void {
  const state = getState()
  state.status.enabled = isEnabled()
  if (!state.status.enabled) {
    pushLog('info', 'cookie-refresh', 'авто-обновление cookies выключено')
    return
  }

  const intervalMs = Math.max(5, env.COOKIE_REFRESH_INTERVAL_MINUTES) * 60 * 1000
  pushLog('info', 'cookie-refresh', `авто-обновление cookies включено, интервал ${env.COOKIE_REFRESH_INTERVAL_MINUTES} мин`)

  // Первый прогон с небольшой задержкой, чтобы sidecar успел подняться.
  setTimeout(() => { void refreshAll() }, 30000)
  state.interval = setInterval(() => { void refreshAll() }, intervalMs)
}

export function stopCookieRefresh(): void {
  const state = getState()
  if (state.interval) {
    clearInterval(state.interval)
    state.interval = null
  }
}
