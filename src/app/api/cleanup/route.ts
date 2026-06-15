import { getDb } from '@/lib/db'
import { getSessionId, validateSession } from '@/lib/auth'
import { env } from '@/lib/env'
import { errorResponse } from '@/lib/errors'
import fs from 'node:fs'
import path from 'node:path'

export async function POST(): Promise<Response> {
  try {
    const sessionId = await getSessionId()
    if (!sessionId || !validateSession(sessionId)) {
      return Response.json({ error: 'unauthorized', code: 'AUTH_ERROR' }, { status: 401 })
    }

    const db = getDb()
    const t = Math.floor(Date.now() / 1000)

    const expired = db
      .prepare("SELECT id, filename FROM jobs WHERE status = 'ready' AND expires_at IS NOT NULL AND expires_at < ?")
      .all(t) as { id: string; filename: string | null }[]

    let deleted = 0
    for (const job of expired) {
      if (job.filename) {
        const filePath = path.join(env.DOWNLOADS_DIR(), job.filename)
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        } catch {
          /* ignore */
        }
      }
      db.prepare('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?').run('expired', t, job.id)
      deleted++
    }

    return Response.json({ deleted })
  } catch (err) {
    return errorResponse(err)
  }
}
