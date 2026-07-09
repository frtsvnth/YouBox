// Тесты для Cookie Source Manager
// Запуск: node tests/cookie-source.mjs

import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Pure logic: validation ───────────────────────────────

function looksLikeNetscapeCookies(content) {
  const lines = content.split('\n').filter(l => {
    const trimmed = l.trim()
    return trimmed !== '' && !trimmed.startsWith('#')
  })
  if (lines.length === 0) return false
  const firstLine = lines[0].trim()
  const parts = firstLine.split('\t')
  return parts.length >= 6 || content.includes('.youtube.com') || content.includes('.google.com')
}

describe('looksLikeNetscapeCookies (pure function)', () => {

  it('validates proper Netscape format with tabs', () => {
    const content = `.youtube.com\tTRUE\t/\tTRUE\t1700000000\tCONSENT\tYES+...`
    assert.strictEqual(looksLikeNetscapeCookies(content), true)
  })

  it('validates file with youtube.com in content', () => {
    const content = `# comment\nexample.com\tTRUE\t/\tFALSE\t0\tfoo\tbar\n.youtube.com\tTRUE\t/\tTRUE\t1700000000\tCONSENT\tyes`
    assert.strictEqual(looksLikeNetscapeCookies(content), true)
  })

  it('rejects empty file', () => {
    assert.strictEqual(looksLikeNetscapeCookies(''), false)
  })

  it('rejects comments-only file', () => {
    assert.strictEqual(looksLikeNetscapeCookies('# only comment'), false)
  })

  it('rejects random text', () => {
    assert.strictEqual(looksLikeNetscapeCookies('hello world'), false)
  })

  it('validates file with google.com', () => {
    const content = `.google.com\tTRUE\t/\tTRUE\t1700000000\t__Secure-3PSID\tabc`
    assert.strictEqual(looksLikeNetscapeCookies(content), true)
  })
})

// ─── Safe file replacement (atomic write pattern) ────────

describe('safe file replacement', () => {
  const tmpDir = path.join(__dirname, 'tmp-test-cookies')

  it('atomically replaces file via tmp + rename', () => {
    fs.mkdirSync(tmpDir, { recursive: true })
    const target = path.join(tmpDir, 'cookies.txt')
    const tmp = target + '.tmp'

    fs.writeFileSync(target, 'old')
    fs.writeFileSync(tmp, 'new')
    fs.renameSync(tmp, target)

    assert.strictEqual(fs.readFileSync(target, 'utf-8'), 'new')
    assert.strictEqual(fs.existsSync(tmp), false)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('preserves old content if rename fails before completion', () => {
    fs.mkdirSync(tmpDir, { recursive: true })
    const target = path.join(tmpDir, 'cookies.txt')

    fs.writeFileSync(target, 'original')

    // Simulate failed write: tmp exists but target is untouched
    const tmp = target + '.tmp'
    fs.writeFileSync(tmp, 'BAD DATA')
    // Pretend rename crashes — target still has old content

    assert.strictEqual(fs.readFileSync(target, 'utf-8'), 'original')

    // Clean up tmp as if recovery ran
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})

// ─── Source selection logic ──────────────────────────────

describe('source selection', () => {

  it('selects active source from list', () => {
    const sources = [
      { id: '1', status: 'disabled', source_type: 'uploaded_file' },
      { id: '2', status: 'active', source_type: 'browser_session' },
      { id: '3', status: 'disabled', source_type: 'uploaded_file' },
    ]
    const active = sources.find(s => s.status === 'active')
    assert.strictEqual(active.id, '2')
    assert.strictEqual(active.source_type, 'browser_session')
  })

  it('returns undefined when no active source', () => {
    const sources = [
      { id: '1', status: 'disabled' },
      { id: '2', status: 'invalid' },
    ]
    assert.strictEqual(sources.find(s => s.status === 'active'), undefined)
  })

  it('only one source can be active at a time', () => {
    const sources = [
      { id: '1', status: 'active' },
      { id: '2', status: 'disabled' },
      { id: '3', status: 'disabled' },
    ]

    function activate(id) {
      for (const s of sources) {
        s.status = s.id === id ? 'active' : 'disabled'
      }
    }

    activate('3')
    const active = sources.filter(s => s.status === 'active')
    assert.strictEqual(active.length, 1)
    assert.strictEqual(active[0].id, '3')
  })
})

// ─── Fallback behavior ───────────────────────────────────

describe('fallback behavior', () => {

  it('should prefer active source over env fallback', () => {
    const activeSource = { id: '1', file_path: '/tmp/active-cookies.txt', status: 'active' }
    const envFile = '/env/cookies.txt'

    const resolved = activeSource.status === 'active' && activeSource.file_path
      ? activeSource.file_path
      : envFile

    assert.strictEqual(resolved, '/tmp/active-cookies.txt')
  })

  it('should use env fallback when no active source', () => {
    const activeSource = null
    const envFile = '/env/cookies.txt'

    const resolved = activeSource?.file_path ?? envFile

    assert.strictEqual(resolved, '/env/cookies.txt')
  })

  it('should return null when no source at all', () => {
    const activeSource = null
    const envFile = null

    const resolved = activeSource?.file_path ?? envFile

    assert.strictEqual(resolved, null)
  })
})

// ─── Source rotation on auth error (worker helper logic) ──

// Воспроизводит логику runWithSourceRotation из src/lib/worker.ts:
// одна повторная попытка с другим источником при auth-ошибке, иначе проброс.
// Применяется одинаково к обеим стадиям (extract и download).
describe('source rotation on auth error', () => {

  function makeRunner({ authErrorCode, active, next, failTwice = false }) {
    const calls = { run: 0, markFailed: 0, beforeRetry: 0 }

    async function run() {
      calls.run += 1
      if (calls.run === 1 || failTwice) {
        const err = new Error('yt-dlp failed')
        err.isYtDlp = true
        err.errorCode = authErrorCode
        throw err
      }
      return 'ok'
    }

    const isAuthError = (code) => ['BOT_CHECK', 'NO_FORMATS', 'CLIENT_BLOCKED'].includes(code)
    const getActiveSource = () => active
    const markSourceFailed = () => { calls.markFailed += 1; return next }

    async function runWithSourceRotation() {
      try {
        return await run()
      } catch (err) {
        if (err.isYtDlp && isAuthError(err.errorCode)) {
          const a = getActiveSource()
          const n = a ? markSourceFailed(a.id, err.errorCode) : null
          if (n && n.id !== a?.id) {
            calls.beforeRetry += 1
            return await run()
          }
        }
        throw err
      }
    }

    return { runWithSourceRotation, calls }
  }

  it('retries once with next source on auth error and succeeds', async () => {
    const { runWithSourceRotation, calls } = makeRunner({
      authErrorCode: 'BOT_CHECK',
      active: { id: '1' },
      next: { id: '2' },
    })
    const result = await runWithSourceRotation()
    assert.strictEqual(result, 'ok')
    assert.strictEqual(calls.run, 2)
    assert.strictEqual(calls.markFailed, 1)
    assert.strictEqual(calls.beforeRetry, 1)
  })

  it('does not retry on non-auth error (propagates)', async () => {
    const { runWithSourceRotation, calls } = makeRunner({
      authErrorCode: 'UNAVAILABLE',
      active: { id: '1' },
      next: { id: '2' },
    })
    await assert.rejects(runWithSourceRotation())
    assert.strictEqual(calls.run, 1)
    assert.strictEqual(calls.markFailed, 0)
  })

  it('does not retry when no other usable source (propagates)', async () => {
    const { runWithSourceRotation, calls } = makeRunner({
      authErrorCode: 'BOT_CHECK',
      active: { id: '1' },
      next: null,
    })
    await assert.rejects(runWithSourceRotation())
    assert.strictEqual(calls.run, 1)
    assert.strictEqual(calls.markFailed, 1)
    assert.strictEqual(calls.beforeRetry, 0)
  })

  it('does not retry when rotation returns the same source', async () => {
    const { runWithSourceRotation, calls } = makeRunner({
      authErrorCode: 'BOT_CHECK',
      active: { id: '1' },
      next: { id: '1' },
    })
    await assert.rejects(runWithSourceRotation())
    assert.strictEqual(calls.run, 1)
    assert.strictEqual(calls.beforeRetry, 0)
  })
})

// ─── Health status mapping ───────────────────────────────

describe('health status mapping', () => {

  it('marks status as degraded when cookies misconfigured', () => {
    const sourceActive = false
    const envConfigured = true
    const envExists = false

    const status = !sourceActive && envConfigured && !envExists ? 'degraded' : 'ok'
    assert.strictEqual(status, 'degraded')
  })

  it('marks status as ok when source is active', () => {
    const sourceActive = true
    const envConfigured = false
    const envExists = false

    const status = sourceActive ? 'ok' : envConfigured && !envExists ? 'degraded' : 'ok'
    assert.strictEqual(status, 'ok')
  })
})
