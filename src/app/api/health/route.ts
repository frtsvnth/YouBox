import { getHealth } from '@/lib/health'

export async function GET(): Promise<Response> {
  const health = await getHealth()
  const statusCode = health.status === 'error' ? 503 : health.status === 'degraded' ? 200 : 200
  return Response.json(health, { status: statusCode })
}
