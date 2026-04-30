import type { NextRequest, NextResponse } from 'next/server'
import { NextResponse as NextResponseImpl } from 'next/server'
import { LocksmithAuthError } from '../error.js'
import type { AuthTokens, UserMe } from '../types.js'
import { isSignInRequiresTotp } from '../types.js'
import {
  LocksmithServerClient,
  type LocksmithServerClientOptions,
} from './locksmith-server.js'

export type LocksmithRouteHandlerConfig = LocksmithServerClientOptions & {
  /**
   * Where you mounted `createLocksmithRouteHandlers`, e.g. `/api/locksmith`.
   * Must match `routePrefix` passed to the React provider / BFF client.
   */
  routeBasePath?: string
  /** Cookie name prefix (default `locksmith` → `locksmith_at`, `locksmith_rt`). */
  cookiePrefix?: string
  /**
   * Dashboard account plan that owns this project. When set, skips `GET /api/auth/sdk/branding`
   * and sets `poweredByLocksmith` to true only for `FREE`.
   */
  accountPlan?: 'FREE' | 'SOLO' | 'PRO'
  /**
   * If `accountPlan` is unset and the branding endpoint fails, use this value (default false).
   */
  brandingFallbackPoweredBy?: boolean
}

function normalizeBase(p: string): string {
  const x = p.endsWith('/') ? p.slice(0, -1) : p
  return x.startsWith('/') ? x : `/${x}`
}

function relativeRoute(pathname: string, base: string): string {
  const b = normalizeBase(base)
  if (!pathname.startsWith(b)) return ''
  return pathname.slice(b.length).replace(/^\//, '')
}

function cookieNames(prefix: string) {
  const p = prefix.replace(/[^a-zA-Z0-9_]/g, '_')
  return { access: `${p}_at`, refresh: `${p}_rt` } as const
}

const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 60

const brandingCache = new Map<string, { t: number; poweredByLocksmith: boolean }>()
const BRANDING_TTL_MS = 5 * 60_000

async function resolvePoweredByLocksmith(
  apiKey: string,
  makeClient: () => LocksmithServerClient,
  cfg: LocksmithRouteHandlerConfig,
): Promise<boolean> {
  if (cfg.accountPlan !== undefined) {
    return cfg.accountPlan === 'FREE'
  }
  const hit = brandingCache.get(apiKey)
  if (hit && Date.now() - hit.t < BRANDING_TTL_MS) {
    return hit.poweredByLocksmith
  }
  try {
    const b = await makeClient().getSdkBranding()
    const v = b.poweredByLocksmith === true
    brandingCache.set(apiKey, { t: Date.now(), poweredByLocksmith: v })
    return v
  } catch {
    return cfg.brandingFallbackPoweredBy === true
  }
}

/**
 * Cookie-based BFF routes so the browser never sees your Locksmith API key.
 * Mount once — see package README.
 */
export function createLocksmithRouteHandlers(cfg: LocksmithRouteHandlerConfig) {
  const basePath = normalizeBase(cfg.routeBasePath ?? '/api/locksmith')
  const names   = cookieNames(cfg.cookiePrefix ?? 'locksmith')

  const client = () =>
    new LocksmithServerClient({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl })

  function attachSession(res: NextResponse, tokens: AuthTokens): void {
    const secure = process.env.NODE_ENV === 'production'
    res.cookies.set(names.access, tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: tokens.expiresIn,
    })
    res.cookies.set(names.refresh, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_COOKIE_MAX_AGE,
    })
  }

  function clearSession(res: NextResponse): void {
    res.cookies.set(names.access, '', { path: '/', maxAge: 0 })
    res.cookies.set(names.refresh, '', { path: '/', maxAge: 0 })
  }

  async function GET(req: NextRequest): Promise<NextResponse> {
    const rel = relativeRoute(req.nextUrl.pathname, basePath)
    if (rel !== 'session') {
      return NextResponseImpl.json(
        { error: 'not_found', message: 'Unknown route' },
        { status: 404 },
      )
    }

    const pb = await resolvePoweredByLocksmith(cfg.apiKey, client, cfg)
    const c    = client()
    const at   = req.cookies.get(names.access)?.value
    const rt   = req.cookies.get(names.refresh)?.value

    if (!at && !rt) {
      return NextResponseImpl.json({
        data: { user: null as UserMe | null, poweredByLocksmith: pb },
      })
    }

    if (at) {
      try {
        const user = await c.getUser(at)
        return NextResponseImpl.json({ data: { user, poweredByLocksmith: pb } })
      } catch {
        /* try refresh */
      }
    }

    if (rt) {
      try {
        const tokens = await c.refresh(rt)
        const user   = await c.getUser(tokens.accessToken)
        const res    = NextResponseImpl.json({ data: { user, poweredByLocksmith: pb } })
        attachSession(res, tokens)
        return res
      } catch {
        const res = NextResponseImpl.json({
          data: { user: null as UserMe | null, poweredByLocksmith: pb },
        })
        clearSession(res)
        return res
      }
    }

    return NextResponseImpl.json({
      data: { user: null as UserMe | null, poweredByLocksmith: pb },
    })
  }

  async function POST(req: NextRequest): Promise<NextResponse> {
    const rel  = relativeRoute(req.nextUrl.pathname, basePath)
    const c    = client()
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    try {
      if (rel === 'login') {
        const result = await c.signIn({
          email:    String(body.email ?? ''),
          password: String(body.password ?? ''),
        })
        if (isSignInRequiresTotp(result)) {
          return NextResponseImpl.json({ data: result })
        }
        const res = NextResponseImpl.json({
          data: { user: result.user, expiresIn: result.expiresIn },
        })
        attachSession(res, result)
        return res
      }

      if (rel === 'signup') {
        const result = await c.signUp({
          email:    String(body.email ?? ''),
          password: String(body.password ?? ''),
          meta:
            typeof body.meta === 'object' && body.meta !== null
              ? (body.meta as Record<string, unknown>)
              : undefined,
        })
        const res = NextResponseImpl.json({
          data: { user: result.user, expiresIn: result.expiresIn },
        })
        attachSession(res, result)
        return res
      }

      if (rel === 'totp') {
        const result = await c.completeSignInTotp(
          String(body.twoFactorToken ?? ''),
          String(body.code ?? ''),
        )
        const res = NextResponseImpl.json({
          data: { user: result.user, expiresIn: result.expiresIn },
        })
        attachSession(res, result)
        return res
      }

      if (rel === 'logout') {
        const rt =
          req.cookies.get(names.refresh)?.value ?? String(body.refreshToken ?? '')
        if (rt) {
          try {
            await c.signOut(rt)
          } catch {
            /* ignore */
          }
        }
        const res = NextResponseImpl.json({ data: { success: true as const } })
        clearSession(res)
        return res
      }

      if (rel === 'refresh') {
        const rt =
          req.cookies.get(names.refresh)?.value ?? String(body.refreshToken ?? '')
        if (!rt) {
          return NextResponseImpl.json(
            { error: 'validation_error', message: 'Missing refresh token' },
            { status: 400 },
          )
        }
        const tokens = await c.refresh(rt)
        const res    = NextResponseImpl.json({ data: { expiresIn: tokens.expiresIn } })
        attachSession(res, tokens)
        return res
      }

      if (rel === 'oauth/exchange') {
        const code = String(body.code ?? '')
        if (!code) {
          return NextResponseImpl.json(
            { error: 'validation_error', message: 'Missing code' },
            { status: 400 },
          )
        }
        const result = await c.exchangeOAuthCode(code)
        const res = NextResponseImpl.json({
          data: { user: result.user, expiresIn: result.expiresIn },
        })
        attachSession(res, result)
        return res
      }

      const oauthProviderMatch = /^oauth\/([^/]+)$/.exec(rel)
      if (oauthProviderMatch) {
        const providerId = oauthProviderMatch[1]!
        if (providerId === 'exchange') {
          return NextResponseImpl.json(
            { error: 'not_found', message: 'Unknown route' },
            { status: 404 },
          )
        }
        const redirectUrl =
          typeof body.redirectUrl === 'string' && body.redirectUrl.length > 0
            ? body.redirectUrl
            : undefined
        const out = await c.initiateOAuth({ provider: providerId, redirectUrl })
        return NextResponseImpl.json({ data: out })
      }

      if (rel === 'oidc/grant') {
        const requestToken = String(body.requestToken ?? '')
        const approved = body.approved === true
        const scopes = Array.isArray(body.scopes)
          ? body.scopes.filter((s): s is string => typeof s === 'string')
          : undefined
        if (!requestToken) {
          return NextResponseImpl.json(
            { error: 'validation_error', message: 'Missing requestToken' },
            { status: 400 },
          )
        }
        let userId: string | undefined
        if (approved) {
          const at = req.cookies.get(names.access)?.value
          if (!at) {
            return NextResponseImpl.json(
              { error: 'invalid_token', message: 'Sign in required to approve.' },
              { status: 401 },
            )
          }
          try {
            const user = await c.getUser(at)
            userId = user.id
          } catch {
            return NextResponseImpl.json(
              { error: 'invalid_token', message: 'Session expired. Sign in again.' },
              { status: 401 },
            )
          }
        }
        const out = await c.completeOidcGrant({
          requestToken,
          approved,
          ...(userId !== undefined ? { userId } : {}),
          ...(scopes !== undefined ? { scopes } : {}),
        })
        return NextResponseImpl.json({ data: out })
      }

      if (rel === 'passkey/login/options') {
        const data = await c.passkeyLoginOptions(String(body.email ?? ''))
        return NextResponseImpl.json({ data })
      }

      if (rel === 'passkey/login/verify') {
        const result = await c.passkeyLoginVerify({
          challengeId: String(body.challengeId ?? ''),
          email:       String(body.email ?? ''),
          response:    (body.response ?? {}) as Record<string, unknown>,
        })
        const res = NextResponseImpl.json({
          data: { user: result.user, expiresIn: result.expiresIn },
        })
        attachSession(res, result)
        return res
      }
    } catch (e) {
      if (e instanceof LocksmithAuthError) {
        return NextResponseImpl.json(
          { error: e.code, message: e.message },
          { status: e.status },
        )
      }
      throw e
    }

    return NextResponseImpl.json(
      { error: 'not_found', message: 'Unknown route' },
      { status: 404 },
    )
  }

  return { GET, POST }
}
