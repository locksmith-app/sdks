export type LocksmithEnvironment = 'production' | 'sandbox'

export type User = {
  id: string
  email: string
  role: string
  meta: Record<string, unknown>
}

export type UserWithTimestamps = User & {
  createdAt: string
}

export type UserMe = User & {
  emailVerified: boolean
  twoFactorEnabled: boolean
  passkeyCount: number
  /** Live RBAC role names from the database (refresh tokens to update JWT claims). */
  roles: string[]
  /** Permission keys resolved from assigned roles. */
  permissions: string[]
  createdAt: string
  lastLoginAt: string | null
}

export type SignInUser = User & {
  lastLoginAt: string | null
}

// ─── RBAC ─────────────────────────────────────────────────────────────────────

export type Role = {
  id:          string
  name:        string
  description: string | null
  color:       string | null
  isDefault:   boolean
  isSystem:    boolean
  createdAt:   string
  updatedAt:   string
}

export type Permission = {
  id:          string
  key:         string
  name:        string
  description: string | null
  category:    string | null
  createdAt:   string
  updatedAt:   string
}

export type RoleWithPermissions = Role & {
  permissions: Array<{ permissionId: string; permission: Permission }>
}

export type UserRoleAssignment = {
  role:       RoleWithPermissions
  assignedAt: string
}

/** JWT access token payload (RS256), after verification */
export type TokenPayload = {
  sub:         string
  email:       string
  /** Legacy single-role string — kept for backward compatibility */
  role:        string
  /** All RBAC role names assigned to this user */
  roles:       string[]
  /** All permission keys resolved from the user's roles */
  permissions: string[]
  environment: LocksmithEnvironment
  meta:        Record<string, unknown>
  aud:         string
  iss:         string
  iat:         number
  exp:         number
}

export type AuthTokens = {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export type SignUpResult = AuthTokens & {
  user: UserWithTimestamps
}

export type SignInResult = AuthTokens & {
  user: SignInUser
}

export type MagicLinkVerifyResult = AuthTokens & {
  user: UserWithTimestamps
}

/** Response from POST /api/auth/oauth/:provider */
export type OAuthInitiateResult = {
  provider: string
  authorizationUrl: string
}

export type OAuthExchangeUser = User & {
  createdAt: string
}

/** Response from POST /api/auth/oauth/token */
export type OAuthTokenExchangeResult = AuthTokens & {
  user: OAuthExchangeUser
  provider: string
}

/** Response from POST /api/auth/oidc/grant */
export type OidcGrantResult = {
  redirectUrl: string
}
