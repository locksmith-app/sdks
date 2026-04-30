import { verify } from 'jsonwebtoken'
import { locksmithEnvironmentFromApiKey } from '../api-key.js'
import { LocksmithAuthError } from '../error.js'
import type {
  AuthTokens,
  MagicLinkVerifyResult,
  OAuthInitiateResult,
  OAuthTokenExchangeResult,
  OidcGrantResult,
  PasskeyListResult,
  SdkBranding,
  SignInPasswordResult,
  SignInResult,
  SignUpResult,
  TokenPayload,
  UserMe,
} from '../types.js'

const DEFAULT_BASE = 'https://getlocksmith.dev'
const DEFAULT_ISSUER = 'https://getlocksmith.dev'

type ApiSuccess<T> = { data: T }
type ApiErr = { error: string; message: string }

export type LocksmithServerClientOptions = {
  apiKey: string
  baseUrl?: string
}

/**
 * Server-only Locksmith client (uses your API key). Use from Route Handlers,
 * Server Actions, and `generateMetadata` — never import in Client Components.
 */
export class LocksmithServerClient {
  readonly apiKey: string
  readonly baseUrl: string
  readonly environment: ReturnType<typeof locksmithEnvironmentFromApiKey>

  constructor(opts: LocksmithServerClientOptions) {
    this.environment = locksmithEnvironmentFromApiKey(opts.apiKey)
    this.apiKey = opts.apiKey
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '')
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  }

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
      throw new LocksmithAuthError(code, msg, res.status)
    }

    const envelope = body as ApiSuccess<T>
    if (!envelope || typeof envelope !== 'object' || !('data' in envelope)) {
      throw new LocksmithAuthError('invalid_response', 'Expected envelope { data }', res.status)
    }
    return envelope.data
  }

  private bearerHeaders(accessToken: string): Headers {
    const headers = new Headers()
    headers.set('Authorization', `Bearer ${accessToken}`)
    return headers
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

  /** Password sign-in; may return `requiresTwoFactor` instead of tokens. */
  async signIn(params: { email: string; password: string }): Promise<SignInPasswordResult> {
    return this.requestJson<SignInPasswordResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  async completeSignInTotp(twoFactorToken: string, code: string): Promise<SignInResult> {
    return this.requestJson<SignInResult>('/api/auth/login/totp', {
      method: 'POST',
      body: JSON.stringify({ twoFactorToken, code }),
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
    const data = await this.requestJson<{ user: UserMe }>('/api/auth/me', {
      method:  'GET',
      headers: this.bearerHeaders(accessToken),
    })
    return data.user
  }

  /**
   * Logo / attribution policy for embedded UIs. Requires `GET /api/auth/sdk/branding` on the Locksmith API.
   * Returns `{ poweredByLocksmith: true }` when the project owner’s plan is Free.
   */
  async getSdkBranding(): Promise<SdkBranding> {
    return this.requestJson<SdkBranding>('/api/auth/sdk/branding', { method: 'GET' })
  }

  verifyAccessToken(accessToken: string, publicKeyPem: string, issuer = DEFAULT_ISSUER): TokenPayload {
    return verify(accessToken, publicKeyPem, {
      algorithms: ['RS256'],
      issuer,
    }) as TokenPayload
  }

  async totpStart(accessToken: string): Promise<{ otpauthUrl: string }> {
    return this.requestJson<{ otpauthUrl: string }>('/api/auth/totp/start', {
      method:  'POST',
      headers: this.bearerHeaders(accessToken),
    })
  }

  async totpConfirm(accessToken: string, code: string): Promise<{ success: true }> {
    return this.requestJson<{ success: true }>('/api/auth/totp/confirm', {
      method:  'POST',
      headers: this.bearerHeaders(accessToken),
      body:    JSON.stringify({ code }),
    })
  }

  async totpDisable(
    accessToken: string,
    params: { code: string; password?: string },
  ): Promise<{ success: true }> {
    return this.requestJson<{ success: true }>('/api/auth/totp/disable', {
      method:  'POST',
      headers: this.bearerHeaders(accessToken),
      body:    JSON.stringify(params),
    })
  }

  async passkeyRegisterOptions(
    accessToken: string,
  ): Promise<{ challengeId: string; options: Record<string, unknown> }> {
    return this.requestJson<{ challengeId: string; options: Record<string, unknown> }>(
      '/api/auth/passkey/register/options',
      { method: 'POST', headers: this.bearerHeaders(accessToken) },
    )
  }

  async passkeyRegisterVerify(
    accessToken: string,
    params: { challengeId: string; response: Record<string, unknown>; label?: string },
  ): Promise<{ success: true; credentialId: string }> {
    return this.requestJson<{ success: true; credentialId: string }>(
      '/api/auth/passkey/register/verify',
      {
        method:  'POST',
        headers: this.bearerHeaders(accessToken),
        body:    JSON.stringify(params),
      },
    )
  }

  async passkeyLoginOptions(
    email: string,
  ): Promise<{ challengeId: string; options: Record<string, unknown> }> {
    return this.requestJson<{ challengeId: string; options: Record<string, unknown> }>(
      '/api/auth/passkey/login/options',
      { method: 'POST', body: JSON.stringify({ email }) },
    )
  }

  async passkeyLoginVerify(params: {
    challengeId: string
    email: string
    response: Record<string, unknown>
  }): Promise<SignInResult> {
    return this.requestJson<SignInResult>('/api/auth/passkey/login/verify', {
      method: 'POST',
      body:   JSON.stringify(params),
    })
  }

  async passkeyList(accessToken: string): Promise<PasskeyListResult> {
    return this.requestJson<PasskeyListResult>('/api/auth/passkey/credentials', {
      method:  'GET',
      headers: this.bearerHeaders(accessToken),
    })
  }

  async passkeyRevoke(accessToken: string, id: string): Promise<{ success: true }> {
    return this.requestJson<{ success: true }>('/api/auth/passkey/revoke', {
      method:  'POST',
      headers: this.bearerHeaders(accessToken),
      body:    JSON.stringify({ id }),
    })
  }

  async sendMagicLink(email: string, options?: { createIfNotExists?: boolean }): Promise<void> {
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

  async verifyMagicLink(params: { token: string; projectId: string }): Promise<MagicLinkVerifyResult> {
    const q = new URLSearchParams({ token: params.token, project: params.projectId })
    const res = await fetch(`${this.baseUrl}/api/auth/magic-link/verify?${q}`)
    const body: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      const errBody = body as Partial<ApiErr>
      throw new LocksmithAuthError(
        typeof errBody.error === 'string' ? errBody.error : 'unknown_error',
        typeof errBody.message === 'string' ? errBody.message : res.statusText,
        res.status,
      )
    }
    const ok = body as ApiSuccess<MagicLinkVerifyResult>
    if (!ok || typeof ok !== 'object' || !('data' in ok)) {
      throw new LocksmithAuthError('invalid_response', 'Expected envelope { data }', res.status)
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

  async exchangeOAuthCode(code: string): Promise<OAuthTokenExchangeResult> {
    return this.requestJson<OAuthTokenExchangeResult>('/api/auth/oauth/token', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  }

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

/**
 * Read `LOCKSMITH_API_KEY` and optional `LOCKSMITH_BASE_URL` / `NEXT_PUBLIC_LOCKSMITH_URL` from the environment.
 */
export function locksmithServerClientFromEnv(): LocksmithServerClient {
  const apiKey = process.env.LOCKSMITH_API_KEY
  if (!apiKey) {
    throw new Error('LOCKSMITH_API_KEY is not set')
  }
  const baseUrl =
    process.env.LOCKSMITH_BASE_URL ?? process.env.NEXT_PUBLIC_LOCKSMITH_URL ?? undefined
  return new LocksmithServerClient({ apiKey, baseUrl })
}
