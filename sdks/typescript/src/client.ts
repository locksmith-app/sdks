import { verify } from 'jsonwebtoken'
import { environmentFromApiKey } from './apiKey.js'
import { LocksmithError } from './errors.js'
import type {
  AuthTokens,
  MagicLinkVerifyResult,
  OAuthInitiateResult,
  OAuthTokenExchangeResult,
  OidcGrantResult,
  Permission,
  Role,
  RoleWithPermissions,
  SignInResult,
  SignUpResult,
  TokenPayload,
  UserMe,
  UserRoleAssignment,
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

  // ── RBAC: Roles ─────────────────────────────────────────────────────────────

  /** List all roles defined for this project. */
  async listRoles(): Promise<RoleWithPermissions[]> {
    const data = await this.requestJson<{ roles: RoleWithPermissions[] }>('/api/auth/rbac/roles')
    return data.roles
  }

  /** Get a single role with its permissions. */
  async getRole(roleId: string): Promise<RoleWithPermissions> {
    const data = await this.requestJson<{ role: RoleWithPermissions }>(`/api/auth/rbac/roles/${encodeURIComponent(roleId)}`)
    return data.role
  }

  /** Create a new role. */
  async createRole(params: {
    name:        string
    description?: string
    color?:       string | null
    isDefault?:   boolean
  }): Promise<RoleWithPermissions> {
    const data = await this.requestJson<{ role: RoleWithPermissions }>('/api/auth/rbac/roles', {
      method: 'POST',
      body: JSON.stringify(params),
    })
    return data.role
  }

  /** Update a role's name, description, color, or default flag. */
  async updateRole(roleId: string, patch: {
    name?:        string
    description?: string | null
    color?:       string | null
    isDefault?:   boolean
  }): Promise<RoleWithPermissions> {
    const data = await this.requestJson<{ role: RoleWithPermissions }>(`/api/auth/rbac/roles/${encodeURIComponent(roleId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    return data.role
  }

  /** Delete a role (not allowed for system roles). */
  async deleteRole(roleId: string): Promise<void> {
    await this.requestJson<{ success: true }>(`/api/auth/rbac/roles/${encodeURIComponent(roleId)}`, {
      method: 'DELETE',
    })
  }

  /** Replace the full permission set on a role. Pass an empty array to clear all permissions. */
  async setRolePermissions(roleId: string, permissionIds: string[]): Promise<RoleWithPermissions> {
    const data = await this.requestJson<{ role: RoleWithPermissions }>(
      `/api/auth/rbac/roles/${encodeURIComponent(roleId)}/permissions`,
      { method: 'PUT', body: JSON.stringify({ permissionIds }) },
    )
    return data.role
  }

  // ── RBAC: Permissions ────────────────────────────────────────────────────────

  /** List all permissions defined for this project. */
  async listPermissions(): Promise<Permission[]> {
    const data = await this.requestJson<{ permissions: Permission[] }>('/api/auth/rbac/permissions')
    return data.permissions
  }

  /** Fetch a single permission by id. */
  async getPermission(permissionId: string): Promise<Permission> {
    const data = await this.requestJson<{ permission: Permission }>(
      `/api/auth/rbac/permissions/${encodeURIComponent(permissionId)}`,
    )
    return data.permission
  }

  /** Create a new permission key. */
  async createPermission(params: {
    key:          string
    name:         string
    description?: string
    category?:    string
  }): Promise<Permission> {
    const data = await this.requestJson<{ permission: Permission }>('/api/auth/rbac/permissions', {
      method: 'POST',
      body: JSON.stringify(params),
    })
    return data.permission
  }

  /** Update a permission's display name, description, or category. */
  async updatePermission(permissionId: string, patch: {
    name?:        string
    description?: string | null
    category?:    string | null
  }): Promise<Permission> {
    const data = await this.requestJson<{ permission: Permission }>(
      `/api/auth/rbac/permissions/${encodeURIComponent(permissionId)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    )
    return data.permission
  }

  /** Delete a permission (also removes it from all roles). */
  async deletePermission(permissionId: string): Promise<void> {
    await this.requestJson<{ success: true }>(
      `/api/auth/rbac/permissions/${encodeURIComponent(permissionId)}`,
      { method: 'DELETE' },
    )
  }

  // ── RBAC: User-role assignment ───────────────────────────────────────────────

  /** All roles Assignment for this user in the current environment (includes assignedAt). */
  async getUserRoles(userId: string): Promise<UserRoleAssignment[]> {
    const data = await this.requestJson<{ assignments: UserRoleAssignment[] }>(
      `/api/auth/rbac/users/${encodeURIComponent(userId)}/roles`,
    )
    return data.assignments
  }

  /** Assign a single role to a user. */
  async assignRole(userId: string, roleId: string): Promise<void> {
    await this.requestJson<{ success: true }>(
      `/api/auth/rbac/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`,
      { method: 'POST' },
    )
  }

  /** Revoke a single role from a user. */
  async revokeRole(userId: string, roleId: string): Promise<void> {
    await this.requestJson<{ success: true }>(
      `/api/auth/rbac/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`,
      { method: 'DELETE' },
    )
  }

  /** Replace all roles for a user. Pass an empty array to remove all roles. */
  async setUserRoles(userId: string, roleIds: string[]): Promise<Role[]> {
    const data = await this.requestJson<{ roles: Role[] }>(
      `/api/auth/rbac/users/${encodeURIComponent(userId)}/roles`,
      { method: 'PUT', body: JSON.stringify({ roleIds }) },
    )
    return data.roles
  }

  // ── RBAC: Local token helpers ────────────────────────────────────────────────

  /**
   * Returns true if the decoded token payload includes the given role name.
   * Use after `verifyToken()` — no network call required.
   */
  static hasRole(token: TokenPayload, role: string): boolean {
    return token.roles.includes(role)
  }

  /**
   * Returns true if the decoded token payload includes the given permission key.
   * Use after `verifyToken()` — no network call required.
   */
  static hasPermission(token: TokenPayload, permission: string): boolean {
    return token.permissions.includes(permission)
  }
}
