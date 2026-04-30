'use client'

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { LocksmithFormShell, LocksmithFormSurface } from './form-shell.js'
import type { LocksmithFormClassNames, LocksmithFormThemeId } from './form-theme.js'
import {
  cardDescriptionStyle,
  cardHeaderStyle,
  cardTitleStyle,
  errorStyle,
  labelStyle,
  outlineButtonStyle,
  primaryButtonStyle,
  sectionStackStyle,
} from './form-theme.js'
import { useLocksmithAuth, useLocksmithPoweredBy } from './provider.js'

const SCOPE_LABELS: Record<string, string> = {
  openid:  'Sign you in (OpenID — required)',
  email:   'Email address',
  profile: 'Profile and name',
}

export type OidcConsentProps = {
  theme?: LocksmithFormThemeId
  classNames?: LocksmithFormClassNames
  /** Render your sign-in form here when the user is not authenticated. */
  signInSlot?: ReactNode
  /** Called immediately before the browser is sent to the OIDC `redirectUrl` (allow or deny). */
  onSuccess?: () => void
  onError?: (message: string) => void
}

function OidcConsentInner({
  theme = 'locksmith',
  classNames,
  signInSlot,
  onSuccess,
  onError,
}: OidcConsentProps) {
  const searchParams = useSearchParams()
  const requestToken = searchParams.get('request_token') ?? ''
  const appName = searchParams.get('app_name') ?? 'An application'
  const scopeRaw = searchParams.get('scope') ?? 'openid'

  const requested = useMemo(
    () => scopeRaw.split(/\s+/).filter(Boolean),
    [scopeRaw],
  )

  const [selected, setSelected] = useState<Set<string>>(() => new Set(requested))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSelected(new Set(requested))
  }, [requested])

  const { user, loading, error, completeOidcConsent, pendingTotpToken } = useLocksmithAuth()
  const poweredBy = useLocksmithPoweredBy()

  async function finish(approved: boolean) {
    if (!requestToken) {
      return
    }
    setBusy(true)
    try {
      let scopes: string[] | undefined
      if (approved) {
        scopes = requested.filter((s) => s === 'openid' || selected.has(s))
        if (!scopes.includes('openid')) {
          scopes = ['openid', ...scopes.filter((s) => s !== 'openid')]
        }
      }
      const redirectUrl = await completeOidcConsent({
        requestToken,
        approved,
        ...(approved && scopes !== undefined ? { scopes } : {}),
      })
      onSuccess?.()
      window.location.href = redirectUrl
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Authorization failed')
      setBusy(false)
    }
  }

  function toggleScope(s: string) {
    if (s === 'openid') {
      return
    }
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(s)) {
        next.delete(s)
      } else {
        next.add(s)
      }
      return next
    })
  }

  if (!requestToken) {
    return (
      <LocksmithFormSurface theme={theme}>
        <header style={cardHeaderStyle()}>
          <h2 style={cardTitleStyle()}>Invalid link</h2>
          <p style={cardDescriptionStyle()}>
            Missing <code>request_token</code>. Open this page from your hosted SSO / OIDC sign-in link only.
          </p>
        </header>
        <p role="alert" style={errorStyle()}>
          This page must be opened from your Locksmith OIDC authorization flow.
        </p>
      </LocksmithFormSurface>
    )
  }

  return (
    <LocksmithFormShell theme={theme} classNames={classNames} poweredByLocksmith={poweredBy}>
      <div style={sectionStackStyle()}>
        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--ls-muted)', margin: 0 }}>Loading…</p>
        ) : pendingTotpToken ? (
          <p style={{ fontSize: 14, color: 'var(--ls-muted)', margin: 0 }}>
            Finish two-factor authentication first, then approve access here.
          </p>
        ) : !user ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <header style={cardHeaderStyle()}>
              <h2 style={cardTitleStyle()}>Sign in</h2>
              <p style={cardDescriptionStyle()}>
                <strong>{appName}</strong> wants to access your account.
              </p>
            </header>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ls-muted)', margin: 0 }}>
              Sign in to review permissions and continue.
            </p>
            {signInSlot ?? (
              <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--ls-faint)', margin: 0 }}>
                Add your sign-in UI via the <code>signInSlot</code> prop, or redirect users to your login page and back
                to this URL.
              </p>
            )}
          </div>
        ) : (
          <>
            <header style={cardHeaderStyle()}>
              <h2 style={cardTitleStyle()}>Approve access</h2>
              <p style={cardDescriptionStyle()}>
                Allow <strong>{appName}</strong> to access your account?
              </p>
            </header>
            <p style={{ fontSize: 13, color: 'var(--ls-muted)', margin: 0 }}>
              Signed in as <strong style={{ color: 'var(--ls-text)' }}>{user.email}</strong>
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--ls-text)' }}>
              This application is requesting:
            </p>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin:    0,
                display:   'flex',
                flexDirection: 'column',
                gap:       10,
              }}
            >
              {requested.map((s) => (
                <li key={s}>
                  <label
                    style={{
                      ...labelStyle(),
                      display:    'flex',
                      gap:        10,
                      alignItems: 'center',
                      cursor:     s === 'openid' ? 'default' : 'pointer',
                      color:      'var(--ls-text)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={s === 'openid' || selected.has(s)}
                      disabled={s === 'openid' || busy}
                      onChange={() => {
                        toggleScope(s)
                      }}
                    />
                    <span>{SCOPE_LABELS[s] ?? s}</span>
                  </label>
                </li>
              ))}
            </ul>
            {error ? (
              <p role="alert" style={{ ...errorStyle(), margin: 0 }}>
                {error}
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={busy}
                className={classNames?.button}
                style={{ ...primaryButtonStyle(busy), width: 'auto', flex: '1 1 120px' }}
                onClick={() => void finish(true)}
              >
                Allow
              </button>
              <button
                type="button"
                disabled={busy}
                className={classNames?.button}
                style={{ ...outlineButtonStyle(busy), width: 'auto', flex: '1 1 120px' }}
                onClick={() => void finish(false)}
              >
                Deny
              </button>
            </div>
          </>
        )}
      </div>
    </LocksmithFormShell>
  )
}

/**
 * **OIDC / hosted SSO consent** — mount on the URL configured as the OIDC app `loginUrl` in Locksmith.
 * Locksmith redirects here with `request_token`, `scope`, and `app_name` query params.
 *
 * Flow: user signs in (use `signInSlot`), then chooses Allow/Deny; the browser is sent to the OIDC client redirect with `code` or `error`.
 */
export function LocksmithOidcConsent(props: OidcConsentProps) {
  return (
    <Suspense
      fallback={
        <LocksmithFormSurface theme={props.theme ?? 'locksmith'}>
          <p style={{ fontSize: 14, color: 'var(--ls-muted)', margin: 0 }}>Loading…</p>
        </LocksmithFormSurface>
      }
    >
      <OidcConsentInner {...props} />
    </Suspense>
  )
}
