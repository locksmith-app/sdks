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
  createdAt: string
  lastLoginAt: string | null
}

export type SignInUser = User & {
  lastLoginAt: string | null
}

/** JWT access token payload (RS256), after verification */
export type TokenPayload = {
  sub: string
  email: string
  role: string
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

export type SignUpResult = AuthTokens & {
  user: UserWithTimestamps
}

export type SignInResult = AuthTokens & {
  user: SignInUser
}

export type MagicLinkVerifyResult = AuthTokens & {
  user: UserWithTimestamps
}
