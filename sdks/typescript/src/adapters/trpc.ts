import type { LocksmithClient } from '../client.js'
import type { UserMe } from '../types.js'

export type LocksmithTRPCContext = {
  user: UserMe | null
}

/** tRPC fetch adapter: reads Bearer token and resolves `user` via {@link LocksmithClient.getUser}. */
export function createTRPCContext(client: LocksmithClient) {
  return async function createContext(opts: { req: Request }): Promise<LocksmithTRPCContext> {
    const raw = opts.req.headers.get('authorization')
    const token = raw?.replace(/^Bearer\s+/i, '')?.trim()
    if (!token) return { user: null }
    try {
      const user = await client.getUser(token)
      return { user }
    } catch {
      return { user: null }
    }
  }
}
