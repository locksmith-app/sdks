# `@getlocksmith/nextjs`

Next.js integration for [Locksmith](https://getlocksmith.dev): **server** client (API key), **cookie BFF** route handlers, **middleware** helper, and **client** React provider with themed sign-in / sign-up / TOTP / passkey UI.

- **API reference:** [getlocksmith.dev/docs/api](https://getlocksmith.dev/docs/api)
- **Base HTTP SDK:** [`@getlocksmith/sdk`](https://www.npmjs.com/package/@getlocksmith/sdk) — use that from non-Next backends.

## Install

```bash
npm install @getlocksmith/nextjs next react react-dom
```

Optional (passkey sign-in button):

```bash
npm install @simplewebauthn/browser
```

## Package entry points

| Import | Use |
|--------|-----|
| `@getlocksmith/nextjs/server` | `LocksmithServerClient`, `createLocksmithRouteHandlers`, `createLocksmithMiddleware`, `locksmithServerClientFromEnv` |
| `@getlocksmith/nextjs/client` | `LocksmithAuthProvider`, forms, `LocksmithBffClient`, theme helpers |
| `@getlocksmith/nextjs` | Shared types, `LocksmithAuthError`, `locksmithEnvironmentFromApiKey` |

## Environment variables (server)

- **`LOCKSMITH_API_KEY`** — project API key (`lsm_live_…` or `lsm_sbx_…`).
- **`LOCKSMITH_BASE_URL`** or **`NEXT_PUBLIC_LOCKSMITH_URL`** — Locksmith origin (optional; defaults to `https://getlocksmith.dev` in the server client).

## BFF route handlers (App Router)

Mount once so the **browser never sees your API key**. Tokens are stored in **httpOnly** cookies.

Create `app/api/locksmith/[[...path]]/route.ts`:

```typescript
import { createLocksmithRouteHandlers, locksmithServerClientFromEnv } from '@getlocksmith/nextjs/server'

const { GET, POST } = createLocksmithRouteHandlers({
  ...locksmithServerClientFromEnv(),
  routeBasePath: '/api/locksmith',
})

export { GET, POST }
```

The catch‑all segment must be `[[...path]]` so `pathname` includes `login`, `session`, etc.

**Branding (Free plan):** the GET `session` response includes `poweredByLocksmith`. The BFF resolves it via `GET /api/auth/sdk/branding` (same API key) or you can set `accountPlan: 'FREE' | 'SOLO' | 'PRO'` on the config to skip that call. See TypeScript types on `LocksmithRouteHandlerConfig`.

## Client provider and forms

```tsx
// app/providers.tsx (client component)
'use client'

import { LocksmithAuthProvider, LocksmithSignInForm } from '@getlocksmith/nextjs/client'

export function AuthProviders({ children }: { children: React.ReactNode }) {
  return (
    <LocksmithAuthProvider routePrefix="/api/locksmith">
      {children}
    </LocksmithAuthProvider>
  )
}
```

```tsx
import { LocksmithSignInForm, LocksmithSignUpForm, LocksmithTotpForm } from '@getlocksmith/nextjs/client'

export function LoginCard() {
  return (
    <>
      <LocksmithSignInForm />
      <LocksmithTotpForm />
    </>
  )
}
```

### Themes and styling

- Default **`theme="locksmith"`** matches the marketing site palette (dark steel + steel-blue accent). Use **`theme="minimal"`** for a light neutral card.
- Pass **`classNames`** (`root`, `label`, `input`, `button`, `error`, `poweredBy`, …) to layer Tailwind or your CSS.
- Export **`locksmithFormThemeStyle`**, **`locksmithMarketingFontNote`**, and other helpers from `@getlocksmith/nextjs/client` for custom layouts. **`LocksmithFormShell`** wraps arbitrary fields with the same card + optional “Powered by” footer.

### Free plan footer

When `poweredByLocksmith` is true (from session), built-in forms render a **“Powered by Locksmith”** line with a link. There is intentionally **no prop to remove it** on Free; upgrade the Locksmith plan or set `accountPlan` on the route config so the API reports paid status.

## Middleware

Validates `Authorization: Bearer <access_token>` against Locksmith **`/api/auth/me`** and sets `x-locksmith-user-id`, `x-locksmith-user-email`, `x-locksmith-user-role` on the request.

```typescript
// middleware.ts
import { createLocksmithMiddleware } from '@getlocksmith/nextjs/server'
import { locksmithServerClientFromEnv } from '@getlocksmith/nextjs/server'

const client = locksmithServerClientFromEnv()

export default createLocksmithMiddleware(client)
```

## Direct server usage (no BFF)

```typescript
import { locksmithServerClientFromEnv } from '@getlocksmith/nextjs/server'

const locksmith = locksmithServerClientFromEnv()
const result = await locksmith.signIn({ email: '…', password: '…' })
```

Prefer this only in Server Actions / Route Handlers — never pass the API key to the client.

## License

MIT
