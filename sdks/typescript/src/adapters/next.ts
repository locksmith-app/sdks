import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { LocksmithClient } from '../client.js'

/**
 * Next.js middleware factory: validates `Authorization: Bearer <access_token>` via `/api/auth/me`
 * and forwards user id, email, and role on request headers.
 */
export function createMiddleware(client: LocksmithClient) {
  return async function middleware(req: NextRequest) {
    const raw = req.headers.get('authorization')
    const token = raw?.replace(/^Bearer\s+/i, '')?.trim()
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    try {
      const user = await client.getUser(token)
      const requestHeaders = new Headers(req.headers)
      requestHeaders.set('x-user-id', user.id)
      requestHeaders.set('x-user-email', user.email)
      requestHeaders.set('x-user-role', user.role)
      return NextResponse.next({ request: { headers: requestHeaders } })
    } catch {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
    }
  }
}
