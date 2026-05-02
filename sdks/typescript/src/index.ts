export { LocksmithClient, type LocksmithClientOptions } from './client.js'
export { LocksmithError } from './errors.js'
export { environmentFromApiKey } from './apiKey.js'
export type {
  AuthTokens,
  LocksmithEnvironment,
  MagicLinkVerifyResult,
  OAuthExchangeUser,
  OAuthInitiateResult,
  OAuthTokenExchangeResult,
  OidcGrantResult,
  Permission,
  Role,
  RoleWithPermissions,
  UserRoleAssignment,
  SignInResult,
  SignUpResult,
  TokenPayload,
  User,
  UserMe,
  UserWithTimestamps,
  SignInUser,
} from './types.js'
