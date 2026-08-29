import { describe, expect, test } from 'bun:test'
import app from '@/server/index'

describe('health', () => {
  test('GET /api/health responds ok', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})
