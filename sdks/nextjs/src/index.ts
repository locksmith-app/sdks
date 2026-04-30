/**
 * @packageDocumentation
 * Locksmith Next.js SDK — import subpaths:
 * - `@getlocksmith/nextjs/server` — server client, route handlers, middleware
 * - `@getlocksmith/nextjs/client` — React provider, BFF browser client, UI
 */

export type { LocksmithEnvironment } from './types.js'
export { locksmithEnvironmentFromApiKey } from './api-key.js'
export { LocksmithAuthError } from './error.js'
export type {
  AuthTokens,
  MagicLinkVerifyResult,
  OAuthExchangeUser,
  OAuthInitiateResult,
  OAuthTokenExchangeResult,
  OidcGrantResult,
  PasskeyCredentialRow,
  PasskeyListResult,
  SdkBranding,
  SignInRequiresTotp,
  SignInResult,
  SignInUser,
  SignUpResult,
  TokenPayload,
  User,
  UserMe,
  UserWithTimestamps,
  SignInPasswordResult,
} from './types.js'
export { isSignInRequiresTotp } from './types.js'
