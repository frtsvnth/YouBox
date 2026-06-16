export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  id: number
  ts: number
  level: LogLevel
  source: string
  msg: string
}

const MAX_LOGS = 500

declare global {
  var __youbox_log_buffer: LogEntry[] | undefined
  var __youbox_log_nextId: number | undefined
}

function getState(): { buffer: LogEntry[]; nextId: number } {
  if (!globalThis.__youbox_log_buffer) {
    globalThis.__youbox_log_buffer = []
  }
  if (!globalThis.__youbox_log_nextId) {
    globalThis.__youbox_log_nextId = 1
  }
  return { buffer: globalThis.__youbox_log_buffer, nextId: globalThis.__youbox_log_nextId }
}

export function pushLog(level: LogLevel, source: string, msg: string): void {
  const { buffer, nextId } = getState()
  buffer.push({ id: nextId, ts: Date.now(), level, source, msg })
  globalThis.__youbox_log_nextId = nextId + 1
  while (buffer.length > MAX_LOGS) buffer.shift()
}

export function getLogs(afterId: number = 0): { logs: LogEntry[]; total: number; nextId: number } {
  const { buffer, nextId } = getState()
  const idx = buffer.findIndex(e => e.id > afterId)
  const logs = idx === -1 ? [] : buffer.slice(idx)
  return { logs, total: buffer.length, nextId }
}

export function clearLogs(): void {
  const { buffer } = getState()
  buffer.length = 0
  globalThis.__youbox_log_nextId = 1
}
