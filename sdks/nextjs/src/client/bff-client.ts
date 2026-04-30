import { LocksmithAuthError } from '../error.js'
import type {
  BffSignInSuccess,
  OidcGrantResult,
  OAuthInitiateResult,
  SignInRequiresTotp,
  SignInUser,
  SignUpResult,
  UserMe,
} from '../types.js'
import { isSignInRequiresTotp } from '../types.js'

export type { BffSignInSuccess }

export type LocksmithBffClientOptions = {
  /**
   * Origin of your Next app (empty string = same origin).
   * Example: `https://myapp.com` when calling a remote deployment.
   */
  origin?: string
  /**
   * Must match `routeBasePath` in `createLocksmithRouteHandlers` (default `/api/locksmith`).
   */
  routePrefix?: string
}

type ApiEnvelope<T> = { data: T }
type ApiErrBody = { error: string; message: string }

/**
 * Browser-safe client: calls your Next.js BFF routes (cookie session), not Locksmith directly.
 */
export class LocksmithBffClient {
  readonly origin: string
  readonly routePrefix: string

  constructor(opts: LocksmithBffClientOptions = {}) {
    this.origin       = (opts.origin ?? '').replace(/\/$/, '')
    this.routePrefix  = normalizeBase(opts.routePrefix ?? '/api/locksmith')
  }

  private path(segment: string): string {
    const s = segment.replace(/^\//, '')
    const p = `${this.routePrefix}/${s}`.replace(/\/+/g, '/')
    return `${this.origin}${p}`
  }

  private async parse<T>(res: Response): Promise<T> {
    const body: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = body as Partial<ApiErrBody>
      throw new LocksmithAuthError(
        typeof err.error === 'string' ? err.error : 'unknown_error',
        typeof err.message === 'string' ? err.message : res.statusText,
        res.status,
      )
    }
    const env = body as ApiEnvelope<T>
    if (!env || typeof env !== 'object' || !('data' in env)) {
      throw new LocksmithAuthError('invalid_response', 'Expected { data }', res.status)
    }
    return env.data
  }

  async session(): Promise<{ user: UserMe | null; poweredByLocksmith: boolean }> {
    const res = await fetch(this.path('session'), {
      method:      'GET',
      credentials: 'include',
    })
    const d = await this.parse<{ user: UserMe | null; poweredByLocksmith?: boolean }>(res)
    return {
      user:               d.user ?? null,
      poweredByLocksmith: d.poweredByLocksmith === true,
    }
  }

  async signIn(email: string, password: string): Promise<SignInRequiresTotp | BffSignInSuccess> {
    const res = await fetch(this.path('login'), {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ email, password }),
    })
    const data = await this.parse<SignInRequiresTotp | BffSignInSuccess>(res)
    if (isSignInRequiresTotp(data)) {
      return data
    }
    return data
  }

  async signUp(params: {
    email: string
    password: string
    meta?: Record<string, unknown>
  }): Promise<Pick<SignUpResult, 'user' | 'expiresIn'>> {
    const res = await fetch(this.path('signup'), {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(params),
    })
    return this.parse(res)
  }

  async completeTotp(twoFactorToken: string, code: string): Promise<BffSignInSuccess> {
    const res = await fetch(this.path('totp'), {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ twoFactorToken, code }),
    })
    return this.parse(res)
  }

  /**
   * Start social OAuth (GitHub, Google, etc.). Redirect the browser to the returned URL.
   * After the provider redirects back with `?code=`, call `exchangeOAuthCode` or use `LocksmithOAuthCallback`.
   */
  async initiateOAuth(
    provider: string,
    redirectUrl?: string,
  ): Promise<OAuthInitiateResult> {
    const res = await fetch(this.path(`oauth/${encodeURIComponent(provider)}`), {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(
        redirectUrl !== undefined && redirectUrl !== '' ? { redirectUrl } : {},
      ),
    })
    return this.parse(res)
  }

  /** Redeem the OAuth `code` query param; sets session cookies. */
  async exchangeOAuthCode(code: string): Promise<BffSignInSuccess> {
    const res = await fetch(this.path('oauth/exchange'), {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ code }),
    })
    return this.parse(res)
  }

  /**
   * Complete OIDC consent after the user signs in. Returns the URL to redirect the browser to
   * (the OIDC client's registered redirect with `code` or `error`).
   */
  async oidcGrant(params: {
    requestToken: string
    approved: boolean
    scopes?: string[]
  }): Promise<OidcGrantResult> {
    const res = await fetch(this.path('oidc/grant'), {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(params),
    })
    return this.parse(res)
  }

  async signOut(refreshToken?: string): Promise<void> {
    const res = await fetch(this.path('logout'), {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(refreshToken ? { refreshToken } : {}),
    })
    await this.parse<{ success: true }>(res)
  }

  async passkeyLoginOptions(
    email: string,
  ): Promise<{ challengeId: string; options: Record<string, unknown> }> {
    const res = await fetch(this.path('passkey/login/options'), {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ email }),
    })
    return this.parse(res)
  }

  async passkeyLoginVerify(params: {
    challengeId: string
    email: string
    response: Record<string, unknown>
  }): Promise<BffSignInSuccess> {
    const res = await fetch(this.path('passkey/login/verify'), {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(params),
    })
    return this.parse(res)
  }
}

function normalizeBase(p: string): string {
  const x = p.endsWith('/') ? p.slice(0, -1) : p
  return x.startsWith('/') ? x : `/${x}`
}
