# `@locksmith/sdk`

Official **TypeScript / JavaScript** client for the [Locksmith](https://getlocksmith.dev) public auth API. Works in **Node 18+** (uses `fetch`). Includes optional adapters for **Next.js** middleware and **tRPC** context.

- **Interactive API reference:** [getlocksmith.dev/docs/api](https://getlocksmith.dev/docs/api)

## Install

```bash
npm install @locksmith/sdk
```

Optional peers (only if you use the adapters):

```bash
npm install next @trpc/server
```

## Requirements

- **Node ≥ 18**
- API key with prefix `lsm_live_` (production) or `lsm_sbx_` (Sandbox). Environment is derived from the key — you never pass it separately.

## Quick start

```typescript
import { LocksmithClient } from '@locksmith/sdk'

const auth = new LocksmithClient({
  apiKey: process.env.LOCKSMITH_API_KEY!,
  // baseUrl optional; defaults to https://getlocksmith.dev
})

const { user, accessToken, refreshToken, expiresIn } = await auth.signIn({
  email: 'user@example.com',
  password: 'secure-password',
})

const me = await auth.getUser(accessToken)
```

## Sign up, refresh, sign out

```typescript
const session = await auth.signUp({ email: '…', password: '…' })
const next = await auth.refresh(session.refreshToken)
await auth.signOut(next.refreshToken)
```

## Magic link & password reset

```typescript
await auth.sendMagicLink('user@example.com')
const verified = await auth.verifyMagicLink({ token, projectId: '…' })
await auth.sendPasswordReset('user@example.com')
await auth.updatePassword({ token: resetToken, newPassword: '…' })
```

## OAuth (social sign-in)

```typescript
const { authorizationUrl } = await auth.initiateOAuth({ provider: 'github /* or google, etc. */' })
// Redirect the user’s browser to authorizationUrl, then on your backend:
const tokens = await auth.exchangeOAuthCode(code)
```

## Hosted SSO (OIDC grant bridge, Pro)

```typescript
const { redirectUrl } = await auth.completeOidcGrant({
  requestToken,
  approved: true,
  userId,
  scopes: ['openid', 'profile', 'email'],
})
```

## Verify access token locally (RS256)

Fetch your project’s public PEM from the dashboard, then:

```typescript
const payload = auth.verifyToken(accessToken, publicKeyPem)
```

## Adapters

- **Next.js:** `import { createMiddleware } from '@locksmith/sdk/adapters/next'`
- **tRPC:** `import { createTRPCContext } from '@locksmith/sdk/adapters/trpc'`

## License

MIT
