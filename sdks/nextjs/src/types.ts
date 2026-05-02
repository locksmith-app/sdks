export type LocksmithEnvironment = 'production' | 'sandbox'

export type User = {
  id: string
  email: string
  role: string
  meta: Record<string, unknown>
}

export type UserWithTimestamps = User & { createdAt: string }

export type UserMe = User & {
  emailVerified: boolean
  twoFactorEnabled?: boolean
  passkeyCount?: number
  /** Live RBAC role names (refresh the session to update JWT claims). */
  roles: string[]
  /** Permission keys resolved from assigned roles. */
  permissions: string[]
  createdAt: string
  lastLoginAt: string | null
}

export type SignInUser = User & { lastLoginAt: string | null }

export type TokenPayload = {
  sub: string
  email: string
  /** Legacy single-role string */
  role: string
  /** RBAC role names */
  roles: string[]
  /** Permission keys from assigned roles */
  permissions: string[]
  environment: LocksmithEnvironment
  meta: Record<string, unknown>
  aud: string
  iss: string
  iat: number
  exp: number
}

export type AuthTokens = {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export type SignUpResult = AuthTokens & { user: UserWithTimestamps }

export type SignInResult = AuthTokens & { user: SignInUser }

export type SignInRequiresTotp = {
  requiresTwoFactor: true
  twoFactorToken: string
}

export type SignInPasswordResult = SignInResult | SignInRequiresTotp

/** BFF login success — tokens are set in httpOnly cookies, not the JSON body. */
export type BffSignInSuccess = { user: SignInUser; expiresIn: number }

export function isSignInRequiresTotp(
  r: SignInPasswordResult | BffSignInSuccess,
): r is SignInRequiresTotp {
  return (
    typeof r === 'object' &&
    r !== null &&
    'requiresTwoFactor' in r &&
    (r as SignInRequiresTotp).requiresTwoFactor === true
  )
}

export type MagicLinkVerifyResult = AuthTokens & { user: UserWithTimestamps }

export type OAuthInitiateResult = { provider: string; authorizationUrl: string }

export type OAuthExchangeUser = User & { createdAt: string }

export type OAuthTokenExchangeResult = AuthTokens & {
  user: OAuthExchangeUser
  provider: string
}

export type OidcGrantResult = { redirectUrl: string }

export type PasskeyCredentialRow = {
  id: string
  label: string | null
  createdAt: string
  lastUsed: string
}

export type PasskeyListResult = { credentials: PasskeyCredentialRow[] }

/** @see GET /api/auth/sdk/branding */
export type SdkBranding = { poweredByLocksmith: boolean }
