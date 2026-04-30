import { verify } from 'jsonwebtoken'
import { environmentFromApiKey } from './apiKey.js'
import { LocksmithError } from './errors.js'
import type {
  AuthTokens,
  MagicLinkVerifyResult,
  OAuthInitiateResult,
  OAuthTokenExchangeResult,
  OidcGrantResult,
  SignInResult,
  SignUpResult,
  TokenPayload,
  UserMe,
} from './types.js'

const DEFAULT_BASE = 'https://getlocksmith.dev'
const ISSUER = 'https://getlocksmith.dev'

type ApiSuccess<T> = { data: T }
type ApiErr = { error: string; message: string }

export type LocksmithClientOptions = {
  apiKey: string
  /** Defaults to https://getlocksmith.dev */
  baseUrl?: string
}

export class LocksmithClient {
  readonly apiKey: string
  readonly baseUrl: string

  /** Derived from the API key prefix (`lsm_live_` → production, `lsm_sbx_` → sandbox). */
  readonly environment: ReturnType<typeof environmentFromApiKey>

  constructor(opts: LocksmithClientOptions) {
    this.environment = environmentFromApiKey(opts.apiKey)
    this.apiKey = opts.apiKey
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '')
  }

  /** @internal */
  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  }

  /** @internal */
  private async requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('X-API-Key', this.apiKey)
    if (!headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json')
    }

    const res = await fetch(this.url(path), { ...init, headers })

    const body: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      const errBody = body as Partial<ApiErr>
      const code = typeof errBody.error === 'string' ? errBody.error : 'unknown_error'
      const msg =
        typeof errBody.message === 'string' ? errBody.message : res.statusText || 'Request failed'
      throw new LocksmithError(code, msg, res.status)
    }

    const envelope = body as ApiSuccess<T>
    if (
      !envelope ||
      typeof envelope !== 'object' ||
      !('data' in envelope)
    ) {
      throw new LocksmithError('invalid_response', 'Expected envelope { data }', res.status)
    }
    return envelope.data
  }

  async signUp(params: {
    email: string
    password: string
    meta?: Record<string, unknown>
  }): Promise<SignUpResult> {
    return this.requestJson<SignUpResult>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: params.email,
        password: params.password,
        ...(params.meta !== undefined ? { meta: params.meta } : {}),
      }),
    })
  }

  async signIn(params: { email: string; password: string }): Promise<SignInResult> {
    return this.requestJson<SignInResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  async signOut(refreshToken: string): Promise<void> {
    await this.requestJson<{ success: true }>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    return this.requestJson<AuthTokens>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })
  }

  async getUser(accessToken: string): Promise<UserMe> {
    const headers = new Headers()
    headers.set('Authorization', `Bearer ${accessToken}`)
    const data = await this.requestJson<{ user: UserMe }>('/api/auth/me', { method: 'GET', headers })
    return data.user
  }

  verifyToken(accessToken: string, publicKeyPem: string): TokenPayload {
    return verify(accessToken, publicKeyPem, {
      algorithms: ['RS256'],
      issuer: ISSUER,
    }) as TokenPayload
  }

  async sendMagicLink(
    email: string,
    options?: { createIfNotExists?: boolean },
  ): Promise<void> {
    await this.requestJson<{ success: true }>('/api/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({
        email,
        ...(options?.createIfNotExists !== undefined
          ? { createIfNotExists: options.createIfNotExists }
          : {}),
      }),
    })
  }

  /**
   * Exchange a magic-link token for session tokens. Usually called from your redirect handler;
   * this endpoint does not require an API key (project id is in the query).
   */
  async verifyMagicLink(params: { token: string; projectId: string }): Promise<MagicLinkVerifyResult> {
    const q = new URLSearchParams({ token: params.token, project: params.projectId })
    const res = await fetch(`${this.baseUrl}/api/auth/magic-link/verify?${q}`)
    const body: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      const errBody = body as Partial<ApiErr>
      throw new LocksmithError(
        typeof errBody.error === 'string' ? errBody.error : 'unknown_error',
        typeof errBody.message === 'string' ? errBody.message : res.statusText,
        res.status,
      )
    }
    const ok = body as ApiSuccess<MagicLinkVerifyResult>
    if (!ok || typeof ok !== 'object' || !('data' in ok)) {
      throw new LocksmithError('invalid_response', 'Expected envelope { data }', res.status)
    }
    return ok.data
  }

  async sendPasswordReset(email: string): Promise<void> {
    await this.requestJson<{ success: true }>('/api/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  async updatePassword(params: { token: string; newPassword: string }): Promise<void> {
    await this.requestJson<{ success: true }>('/api/auth/password/update', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /**
   * Start social OAuth sign-in. Redirect the end user's browser to `authorizationUrl`.
   * The provider must be enabled in the dashboard for this project.
   */
  async initiateOAuth(params: {
    provider: string
    redirectUrl?: string | null
  }): Promise<OAuthInitiateResult> {
    const path = `/api/auth/oauth/${encodeURIComponent(params.provider)}`
    const body =
      params.redirectUrl !== undefined && params.redirectUrl !== null && params.redirectUrl !== ''
        ? JSON.stringify({ redirectUrl: params.redirectUrl })
        : JSON.stringify({})
    return this.requestJson<OAuthInitiateResult>(path, { method: 'POST', body })
  }

  /**
   * Exchange the OAuth `code` from your redirect URL for Locksmith session tokens.
   * Call from your backend only (requires API key).
   */
  async exchangeOAuthCode(code: string): Promise<OAuthTokenExchangeResult> {
    return this.requestJson<OAuthTokenExchangeResult>('/api/auth/oauth/token', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  }

  /**
   * Hosted SSO (OIDC): after `/authorize` sends the user to your login UI with `request_token`,
   * call this from your backend to get the final browser `redirectUrl` (requires Pro plan).
   */
  async completeOidcGrant(params: {
    requestToken: string
    approved: boolean
    userId?: string
    scopes?: string[]
  }): Promise<OidcGrantResult> {
    return this.requestJson<OidcGrantResult>('/api/auth/oidc/grant', {
      method: 'POST',
      body: JSON.stringify({
        requestToken: params.requestToken,
        approved: params.approved,
        ...(params.userId !== undefined ? { userId: params.userId } : {}),
        ...(params.scopes !== undefined ? { scopes: params.scopes } : {}),
      }),
    })
  }
}