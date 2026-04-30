import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  LocksmithServerClient,
  type LocksmithServerClientOptions,
} from './locksmith-server.js'

/**
 * Validates `Authorization: Bearer <access_token>` against Locksmith `/api/auth/me`
 * and forwards user id, email, and role on request headers.
 */
export function createLocksmithMiddleware(opts: LocksmithServerClientOptions) {
  const client = new LocksmithServerClient(opts)
  return async function locksmithMiddleware(request: NextRequest) {
    const raw   = request.headers.get('authorization')
    const token = raw?.replace(/^Bearer\s+/i, '')?.trim()
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    try {
      const user           = await client.getUser(token)
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-locksmith-user-id', user.id)
      requestHeaders.set('x-locksmith-user-email', user.email)
      requestHeaders.set('x-locksmith-user-role', user.role)
      return NextResponse.next({ request: { headers: requestHeaders } })
    } catch {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
    }
  }
}
