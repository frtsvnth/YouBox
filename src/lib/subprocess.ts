import { spawn } from 'node:child_process'

const MINIMAL_ENV: Record<string, string | undefined> = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,
}

export interface SubprocessResult {
  stdout: string
  stderr: string
  exitCode: number | null
}

export interface SubprocessOptions {
  bin: string
  args: string[]
  timeout?: number
  env?: Record<string, string | undefined>
  sensitiveArgIndices?: number[]
  onStderrLine?: (line: string) => void
}

export async function runSubprocess(options: SubprocessOptions): Promise<SubprocessResult> {
  const {
    bin,
    args,
    timeout = 30000,
    env: extraEnv,
    sensitiveArgIndices = [],
  } = options

  const safeArgs = args.map((arg, i) =>
    sensitiveArgIndices.includes(i) ? '<redacted>' : arg,
  )

  if (process.env.LOG_LEVEL === 'debug') {
    console.debug(`[subprocess] ${bin} ${safeArgs.join(' ')}`)
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
      env: { ...MINIMAL_ENV, ...extraEnv } as NodeJS.ProcessEnv,
      shell: false,
    })

    let stdout = ''
    let stderr = ''
    let stderrBuffer = ''

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString()
      const lines = stderrBuffer.split('\n')
      stderrBuffer = lines.pop() ?? ''
      for (const line of lines) {
        if (options.onStderrLine) {
          options.onStderrLine(line)
        }
      }
      stderr += lines.join('\n') + '\n'
    })

    proc.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error(`binary not found: ${bin}`))
      } else {
        reject(new Error(`failed to spawn ${bin}: ${err.message}`))
      }
    })

    proc.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode })
    })
  })
}

export function buildArgs(base: string[], extra: Record<string, string | boolean | undefined>): string[] {
  const args: string[] = [...base]
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === false) continue
    const prefix = key.length === 1 ? '-' : '--'
    if (value === true) {
      args.push(`${prefix}${key}`)
    } else {
      args.push(`${prefix}${key}`, String(value))
    }
  }
  return args
}
