# Migrating Locksmith docs from Scalar (Next.js) to Docusaurus

This guide is written for **Locksmith** and applies to any Next.js + Scalar setup. It is **opinionated**: use **Docusaurus 3** + **`docusaurus-plugin-openapi-docs`** (the maintained OpenAPI integration for Docusaurus), TypeScript config, a **standalone docs app** in the monorepo, and **Vercel** (or any static host) for deployment.

**Anti-patterns (callouts):**

- **Embedding Docusaurus inside Next.js App Router** — Do not try to mount Docusaurus as a React subtree in `app/docs`. Two routers, two build pipelines, broken HMR and broken search. **Run docs as a separate app** in the same repo.
- **Duplicating OpenAPI by hand** — Generate API pages from a **single source** (your existing `LOCKSMITH_OPENAPI` / `/api/openapi`). Never maintain parallel Markdown for every endpoint.
- **Skipping versioned API** — If you ship breaking API changes, plan for `versioned_docs` + versioned OpenAPI (plugin supports it). For v1 single version, keep one `docs/` + one spec.

---

## 1. Migration plan

### Phase A — Extract the OpenAPI spec

1. **Single artifact**: Commit or generate `openapi.json` (or `openapi.yaml`) that matches production.
   - **Option 1 (recommended):** Add a small script in the docs package: `node scripts/write-openapi.mjs` that **imports** `LOCKSMITH_OPENAPI` from `../frontend/src/lib/openapi/locksmith-openapi.ts` (or a shared `packages/openapi-spec` if you split it) and writes `static/openapi.json`.
   - **Option 2:** CI step: `curl -sSf "$APP_URL/api/openapi" -o static/openapi.json` (fragile if the app is down; prefer build-time import).
2. Freeze **code samples**: Your spec already uses `x-codeSamples` (see `sdk-x-code-samples.ts`). The OpenAPI plugin can show them per operation—keep that as the **canonical** multi-SDK snippet source so you do not maintain duplicate tabs in MDX for every route.

### Phase B — Scaffold Docusaurus

1. At repo root: `npx create-docusaurus@latest apps/docs classic --typescript` (folder name can be `documentation` or `apps/docs`).
2. Install OpenAPI plugin (exact versions pin in section 3).
3. Point the plugin at `static/openapi.json` (or `openapi/openapi.yaml`).
4. Run `yarn / pnpm` in monorepo root with workspaces if you already use them; add `apps/docs` as a workspace package.

### Phase C — Port narrative content

1. Move **`sdk-usage-markdown.ts`** content into real **MDX pages** under `docs/sdks/`, `docs/frameworks/`, `docs/guides/`—Scalar’s single giant description becomes structured, linkable pages.
2. Keep **one** “Overview” page that links to API reference sidebar + SDK index.
3. Redirect old URLs: Next.js `/docs` → marketing; after cutover, `getlocksmith.dev/docs` should hit **Docusaurus** (subdomain or path—see deployment).

### Phase D — Remove Scalar

1. Delete `@scalar/nextjs-api-reference` from `frontend/package.json`.
2. Remove `frontend/src/app/docs/api/route.ts` and any Scalar-only assets (`scalar-on-loaded.ts` if unused elsewhere).
3. Replace footer/nav **Documentation** link from `/docs/api` to the **new docs URL** (e.g. `https://docs.getlocksmith.dev` or `/docs` behind reverse proxy).
4. Keep **`GET /api/openapi`** on the Next app for **external tools** (Insomnia, CI validators); the docs site can still consume the same JSON at build time.

### Phase E — Deploy

1. **Vercel project** → Root directory `apps/docs`, build `pnpm build`, output `build/`.
2. Or **GitHub Actions** → `pnpm build` + upload `build/` to S3/Cloudflare Pages.
3. Custom domain `docs.getlocksmith.dev` (or path-based—path-based on same origin as Next is harder; subdomain is cleaner).

---

## 2. Recommended project structure

```
locksmith/
├── frontend/                      # Existing Next.js (dashboard + API)
│   └── src/lib/openapi/           # LOCKSMITH_OPENAPI source (keep as SoT)
├── apps/
│   └── docs/                      # NEW: Docusaurus site
│       ├── package.json
│       ├── docusaurus.config.ts
│       ├── sidebars.ts
│       ├── tsconfig.json
│       ├── static/
│       │   └── openapi.json       # Generated at build (see frontend/scripts/export-openapi.ts)
│       ├── docs/
│       │   ├── intro.mdx
│       │   ├── api/
│       │   │   └── _category_.yml # Optional; plugin generates most API pages
│       │   ├── sdks/
│       │   │   ├── _category_.yml
│       │   │   ├── index.mdx           # SDK hub
│       │   │   ├── typescript.mdx
│       │   │   ├── python.mdx
│       │   │   ├── go.mdx
│       │   │   ├── rust.mdx
│       │   │   ├── ruby.mdx
│       │   │   ├── php.mdx
│       │   │   ├── dotnet.mdx
│       │   │   ├── java.mdx
│       │   │   ├── kotlin.mdx
│       │   │   ├── dart.mdx
│       │   │   ├── elixir.mdx
│       │   │   └── swift.mdx
│       │   ├── frameworks/
│       │   │   ├── _category_.yml
│       │   │   └── nextjs.mdx          # @getlocksmith/nextjs — full guide
│       │   └── guides/
│       │       ├── _category_.yml
│       │       ├── authentication.mdx  # JWT, sessions, cookies
│       │       ├── webhooks.mdx
│       │       └── rate-limits.mdx
│       └── src/
│           ├── components/
│           │   ├── SdkInstallTabs.tsx
│           │   ├── CodeSampleTabs.tsx
│           │   ├── ApiRequest.tsx
│           │   ├── AuthHeader.tsx
│           │   └── Callout.tsx
│           └── css/
│               └── custom.css
└── sdks/                          # Source READMEs — link or embed summary in MDX
    ├── typescript/
    ├── python/
    ├── go/
    ├── rust/
    ├── ruby/
    ├── php/
    ├── dotnet/
    ├── java/
    ├── kotlin/
    ├── dart/
    ├── elixir/
    ├── swift/
    ├── nextjs/                    # Framework SDK
    └── cpp/                       # Stub / future — document honestly
```

**SDK coverage (document each in full in `docs/sdks/`):**

| Doc page        | Package / repo (as in monorepo)        |
|-----------------|----------------------------------------|
| TypeScript      | `@getlocksmith/sdk` / `sdks/typescript` |
| Python          | `locksmith-py` / `sdks/python`        |
| Go              | `github.com/locksmith-app/sdk-go` / `sdks/go` |
| Rust            | crate `getlocksmith` / `sdks/rust`    |
| Ruby            | `locksmith-ruby` / `sdks/ruby`        |
| PHP             | `locksmith/sdk-php` / `sdks/php`      |
| .NET            | `Locksmith.Sdk` / `sdks/dotnet`       |
| Java            | `app.locksmith:locksmith-java` / `sdks/java` |
| Kotlin          | `app.locksmith` / `sdks/kotlin`       |
| Dart            | `locksmith_dart` / `sdks/dart`        |
| Elixir          | `locksmith_ex` / `sdks/elixir`        |
| Swift           | SwiftPM `Locksmith` / `sdks/swift`    |
| C++             | `sdks/cpp` (stub—say “coming soon” or omit until real) |

**Framework SDKs (`docs/frameworks/`):**

| Page    | Package                    | Notes                                      |
|---------|----------------------------|--------------------------------------------|
| Next.js | `@getlocksmith/nextjs`     | Server/client entry points, BFF, middleware, themed forms, branding—**full** guide from `sdks/nextjs/README.md` expanded in MDX |

Add more frameworks later (e.g. Remix, Nuxt) as separate MDX files; do not lump them into “misc.”

---

## 3. Docusaurus setup

### Install (from `apps/docs`)

```bash
cd apps/docs
npx create-docusaurus@latest . classic --typescript
pnpm add docusaurus-plugin-openapi-docs docusaurus-theme-openapi-docs
```

Use **`pnpm`** or **`yarn`** consistently with the monorepo. Pin plugin versions compatible with your Docusaurus minor (Locksmith uses Docusaurus **3.10.x** with OpenAPI plugin/theme **5.x**).

**OpenAPI at build:** Run `npm run write:openapi` from `apps/docs` (delegates to `frontend`’s `export-openapi`, which writes `static/openapi.json`). Then `docusaurus gen-api-docs locksmith` before `docusaurus build`.

### `docusaurus.config.ts` (example)

```typescript
import type { Config } from '@docusaurus/types'
import type * as Preset from '@docusaurus/preset-classic'

const config: Config = {
  title: 'Locksmith',
  tagline: 'Auth in an afternoon.',
  url: 'https://docs.getlocksmith.dev',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  organizationName: 'locksmith-app',
  projectName: 'locksmith-docs',

  onBrokenLinks: 'throw',
  markdown: { format: 'mdx', mermaid: true },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/locksmith-app/docs/edit/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      'docusaurus-plugin-openapi-docs',
      {
        id: 'api',
        docsPluginId: 'classic',
        config: {
          locksmith: {
            specPath: 'static/openapi.json',
            outputDir: 'docs/api/generated',
            sidebarOptions: { groupPathsBy: 'tag', categoryLinkSource: 'tag' },
            downloadUrl: '/openapi.json',
            hideSendButton: false,
          },
        },
      },
    ],
  ],

  themes: ['@docusaurus/theme-openapi-docs'],

  themeConfig: {
    navbar: {
      title: 'Locksmith',
      items: [
        { type: 'docSidebar', sidebarId: 'main', position: 'left', label: 'Docs' },
        { type: 'docSidebar', sidebarId: 'api', position: 'left', label: 'API' },
        { href: 'https://getlocksmith.dev', label: 'App', position: 'right' },
      ],
    },
    footer: { style: 'dark', copyright: `© ${new Date().getFullYear()} Locksmith` },
    colorMode: { defaultMode: 'dark', disableSwitch: false, respectPrefersColorScheme: true },
    prism: {
      theme: require('prism-react-renderer').themes.github,
      darkTheme: require('prism-react-renderer').themes.dracula,
      additionalLanguages: ['bash', 'json', 'http'],
    },
  },
}

export default config
```

**Note:** Exact keys for `docusaurus-plugin-openapi-docs` (`outputDir`, `sidebarOptions`) follow the plugin’s current docs—verify against the version you install.

### `sidebars.ts` (dual sidebar: narrative + API)

```typescript
import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  main: [
    'intro',
    {
      type: 'category',
      label: 'Guides',
      items: [{ type: 'autogenerated', dirName: 'guides' }],
    },
    {
      type: 'category',
      label: 'SDKs',
      link: { type: 'doc', id: 'sdks/index' },
      items: [{ type: 'autogenerated', dirName: 'sdks' }],
    },
    {
      type: 'category',
      label: 'Frameworks',
      items: [{ type: 'autogenerated', dirName: 'frameworks' }],
    },
  ],
  api: [{ type: 'autogenerated', dirName: 'api/generated' }],
}

export default sidebars
```

Wire the **API** sidebar in `docusaurus.config.ts` via the OpenAPI plugin’s generated sidebar helper if the plugin exports one (many setups use `openAPISidebar` from a generated file—follow the plugin README for your version).

---

## 4. OpenAPI integration

**Plugin:** `docusaurus-plugin-openapi-docs` + `@docusaurus/theme-openapi-docs`.

**Flow:**

1. **Build step**: `pnpm docs:openapi` → writes `static/openapi.json` from your TypeScript `LOCKSMITH_OPENAPI` object (same shape as `GET /api/openapi`).
2. **Docusaurus build**: `pnpm build` runs plugin → generates MDX under `docs/api/generated/` (or configured `outputDir`).
3. **Sync**: Any change to `locksmith-openapi.ts` or route handlers → regenerate JSON in CI before `docusaurus build`.

**Example `scripts/write-openapi.mjs`** (if you compile TS first or use `tsx`):

```bash
pnpm add -D tsx
```

```javascript
// scripts/write-openapi.mjs — adjust import path to your monorepo layout
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// After extracting shared spec to packages/openapi, import from there.
const { LOCKSMITH_OPENAPI } = await import('../../frontend/src/lib/openapi/locksmith-openapi.ts')

writeFileSync(
  join(__dirname, '../static/openapi.json'),
  JSON.stringify(LOCKSMITH_OPENAPI, null, 2),
)
```

**Better long-term:** Move `LOCKSMITH_OPENAPI` to `packages/openapi-spec` and depend on it from **both** `frontend` and `apps/docs` to avoid deep relative imports.

**Keeping `x-codeSamples`:** The plugin renders operation pages; ensure your OpenAPI operation objects still carry `x-codeSamples` arrays—those become the language tabs on each endpoint (Stripe-like UX).

---

## 5. MDX component system

Create `apps/docs/src/theme/MDXComponents.tsx` to merge custom components (Docusaurus 3 pattern):

```typescript
import type { MDXComponents } from '@mdx-js/react'
import MDXComponents from '@theme-original/MDXComponents'
import { SdkInstallTabs } from '@site/src/components/SdkInstallTabs'
import { CodeSampleTabs } from '@site/src/components/CodeSampleTabs'
import { ApiRequest } from '@site/src/components/ApiRequest'
import { AuthHeader } from '@site/src/components/AuthHeader'
import { Callout } from '@site/src/components/Callout'

export default {
  ...MDXComponents,
  SdkInstallTabs,
  CodeSampleTabs,
  ApiRequest,
  AuthHeader,
  Callout,
} satisfies MDXComponents
```

### `src/components/Callout.tsx`

```tsx
import clsx from 'clsx'
import styles from './Callout.module.css'

type Variant = 'note' | 'tip' | 'warning' | 'danger'

export function Callout({
  children,
  title,
  variant = 'note',
}: {
  children: React.ReactNode
  title?: string
  variant?: Variant
}) {
  return (
    <div className={clsx(styles.callout, styles[variant])}>
      {title ? <strong className={styles.title}>{title}</strong> : null}
      <div className={styles.body}>{children}</div>
    </div>
  )
}
```

### `src/components/SdkInstallTabs.tsx`

```tsx
import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'

export function SdkInstallTabs() {
  return (
    <Tabs>
      <TabItem value="npm" label="npm">
        <pre>
          <code>npm install @getlocksmith/sdk</code>
        </pre>
      </TabItem>
      <TabItem value="pnpm" label="pnpm">
        <pre>
          <code>pnpm add @getlocksmith/sdk</code>
        </pre>
      </TabItem>
      <TabItem value="yarn" label="yarn">
        <pre>
          <code>yarn add @getlocksmith/sdk</code>
        </pre>
      </TabItem>
    </Tabs>
  )
}
```

### `src/components/AuthHeader.tsx`

```tsx
export function AuthHeader() {
  return (
    <table>
      <thead>
        <tr>
          <th>Header</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <code>X-API-Key</code>
          </td>
          <td>
            <code>lsm_live_…</code> or <code>lsm_sbx_…</code>
          </td>
        </tr>
        <tr>
          <td>
            <code>Authorization</code>
          </td>
          <td>
            <code>Bearer &lt;access_token&gt;</code> (for <code>/me</code> and bearer-only routes)
          </td>
        </tr>
      </tbody>
    </table>
  )
}
```

### `src/components/ApiRequest.tsx`

```tsx
import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'

export function ApiRequest({
  method,
  path,
  children,
}: {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  children?: React.ReactNode
}) {
  return (
    <div className="margin-bottom--md">
      <div>
        <strong>{method}</strong> <code>{path}</code>
      </div>
      {children ? (
        <Tabs>
          <TabItem value="body" label="Body">
            {children}
          </TabItem>
        </Tabs>
      ) : null}
    </div>
  )
}
```

Use **`CodeSampleTabs`** only for narrative pages; for generated OpenAPI pages, rely on the plugin + `x-codeSamples`.

### `src/components/CodeSampleTabs.tsx` (narrative pages)

```tsx
import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'

export function CodeSampleTabs({
  ts,
  py,
  go,
}: {
  ts: string
  py?: string
  go?: string
}) {
  return (
    <Tabs groupId="sdk-lang">
      <TabItem value="ts" label="TypeScript">
        <pre>
          <code className="language-typescript">{ts}</code>
        </pre>
      </TabItem>
      {py ? (
        <TabItem value="py" label="Python">
          <pre>
            <code className="language-python">{py}</code>
          </pre>
        </TabItem>
      ) : null}
      {go ? (
        <TabItem value="go" label="Go">
          <pre>
            <code className="language-go">{go}</code>
          </pre>
        </TabItem>
      ) : null}
    </Tabs>
  )
}
```

---

## 6. Example MDX pages

### `docs/intro.mdx`

```mdx
---
sidebar_position: 0
title: Introduction
---

import { Callout } from '@site/src/components/Callout'

Locksmith is a JWT authentication API for end-user apps. Use the **API** section for every endpoint, **SDKs** for language clients, and **Frameworks** for Next.js (cookie BFF, React UI).

<Callout variant="warning" title="Never expose your API key">
  Use <code>lsm_live_</code> / <code>lsm_sbx_</code> keys only on your **server**. Browser code should call **your** backend or a cookie-based BFF (see Next.js framework guide).
</Callout>
```

### SDK quickstart — `docs/sdks/typescript.mdx` (full structure: install, env, sign-in, refresh, links)

```mdx
---
title: TypeScript & JavaScript
---

import { SdkInstallTabs } from '@site/src/components/SdkInstallTabs'
import { Callout } from '@site/src/components/Callout'

# TypeScript (`@getlocksmith/sdk`)

<SdkInstallTabs />

## Quick start

```ts
import { LocksmithClient } from '@getlocksmith/sdk'

const auth = new LocksmithClient({
  apiKey: process.env.LOCKSMITH_API_KEY!,
})

const { user, accessToken, refreshToken, expiresIn } = await auth.signIn({
  email: 'user@example.com',
  password: 'secure-password',
})
```

## Environment

Environment is derived from the key prefix (`lsm_live_` = Production, `lsm_sbx_` = Sandbox)—never pass environment separately.

## OAuth, magic link, webhooks

- OAuth: `initiateOAuth` → redirect → `exchangeOAuthCode` (server-side).
- Magic link: `sendMagicLink` / `verifyMagicLink`.
- Webhooks: configure in dashboard; verify `X-Locksmith-Signature` (see **Guides → Webhooks**).

<Callout variant="tip" title="Next.js">
  For cookie sessions and UI components, use <a href="../frameworks/nextjs">@getlocksmith/nextjs</a>.
</Callout>

## Reference

Full README and advanced usage: [npm @getlocksmith/sdk](https://www.npmjs.com/package/@getlocksmith/sdk).
```

**Repeat the same depth for each language** under `docs/sdks/{language}.mdx` (install command, 15-line quickstart, link to npm/crates.io/PyPI, link to API + guides). Copy authoritative examples from each `sdks/*/README.md`.

### Framework — `docs/frameworks/nextjs.mdx`

Mirror and extend `sdks/nextjs/README.md`:

- Install + peers (`@simplewebauthn/browser` optional).
- `@getlocksmith/nextjs/server` vs `/client` vs root.
- Env vars.
- **Full** `app/api/locksmith/[[...path]]/route.ts` example.
- `LocksmithAuthProvider`, forms, TOTP, passkey button.
- Themes + Free-plan “Powered by” policy.
- Middleware snippet.
- Link to TypeScript SDK for non-BFF server usage.

### Authentication overview — `docs/guides/authentication.mdx`

```mdx
---
title: Authentication overview
---

import AuthHeader from '@site/src/components/AuthHeader'
import { Callout } from '@site/src/components/Callout'

# Authentication

## API key (project + environment)

<AuthHeader />

## End-user JWT access tokens

- RS256, project public key in dashboard.
- Short TTL; refresh with refresh token (server-side).

## Sessions in SPAs vs Next.js

- **SPA:** Store refresh token securely (httpOnly cookie via your API, not in localStorage if avoidable).
- **Next.js:** Prefer `@getlocksmith/nextjs` BFF so tokens stay httpOnly.

<Callout variant="note" title="Sandbox">
  Sandbox is labeled **Sandbox** everywhere—never “development” or “dev” in product copy.
</Callout>
```

### API endpoint narrative (optional wrapper)

Prefer **generated** pages from OpenAPI. If you need a custom **overview** per tag, add `docs/api/overview-auth.mdx` and link from sidebar; do not duplicate every path.

---

## 7. Styling & UX (Stripe / Vercel grade)

- **Dark default** + respect `prefers-color-scheme`: set in `themeConfig.colorMode`.
- **Typography**: Use a clean sans (e.g. system stack or **Inter** via `@fontsource/inter`). Vercel docs use restrained contrast; avoid loud gradients in prose.
- **Sidebar**: Two sidebars—**Docs** (guides, SDKs, frameworks) and **API** (tags → operations). Same pattern as Stripe’s “Docs” vs “API Reference”.
- **Search**: Enable **Algolia DocSearch** once the site is public (Docusaurus preset supports it).
- **custom.css**: Tweak `--ifm-color-primary` to match Locksmith steel-blue (`oklch` / hex from your marketing CSS).
- **MDX**: Keep callouts subtle; use table + `code` styling from Infima defaults before customizing.

---

## 8. Migration strategy

**Recommended: separate app**

| Approach | Verdict |
|----------|---------|
| `apps/docs` + same monorepo | **Yes** — shared OpenAPI source, independent deploy, clean UX |
| Docusaurus inside Next route | **No** — fragile, not supported first-class |
| Same domain `/docs` reverse-proxy to static | **Yes** — map `/docs/*` to docs host or upload static to Vercel subpath (subdomain simpler) |

**Incremental cutover:**

1. Ship Docusaurus to `docs.staging.getlocksmith.dev` with password or allowlist.
2. Port high-traffic pages first (Intro, TS SDK, Next.js, API).
3. Switch navbar link; 301 old `/docs/api` Scalar URL to new API entry.
4. Remove Scalar deps.

---

## 9. Deployment

### Vercel (recommended)

- **New project** → Framework preset “Other”, Root `apps/docs`.
- **Build command**: `pnpm install && pnpm run build` (or `pnpm write:openapi && pnpm build`).
- **Output directory**: `build`.
- **Environment**: None required for static docs unless you add analytics.

### CI/CD

- On PR: `pnpm exec tsc --noEmit` in docs app + validate `openapi.json` (**swagger-cli validate** or **`@redocly/cli lint`**).
- On main: build + deploy; optionally **upload `openapi.json`** as a build artifact for external consumers.

### Static hosting (Cloudflare Pages, S3+CloudFront)

- Same `build/` output; set **cache headers** for HTML (short) vs assets (long).

---

## Checklist before removing Scalar

- [x] `static/openapi.json` generated at build from the same `LOCKSMITH_OPENAPI` source as the Next app (`frontend/scripts/export-openapi.ts` → `apps/docs/static/openapi.json`; wire the same commands in CI).
- [x] SDK doc pages + **Next.js framework** page (`docs/sdks/*`, `docs/frameworks/nextjs.mdx`).
- [x] Guides: authentication, webhooks, rate limits (`docs/guides/`).
- [ ] Optional: OAuth/OIDC high-level guide (not ported yet).
- [x] Navbar + dual sidebar; API sidebar from `gen-api-docs`; operations show `x-codeSamples` from the spec.
- [x] Redirects: Next.js `/docs` and `/docs/api` → Docusaurus base URL; `@docusaurus/plugin-client-redirects` maps `/api/locksmith` → OpenAPI intro slug for bookmarks.
- [x] `@scalar/nextjs-api-reference` removed from frontend; keep `GET /api/openapi` for external tooling.

---

*Document version: 1.1 — implementation in `apps/docs`; Docusaurus 3.10 + OpenAPI plugin 5.x.*
