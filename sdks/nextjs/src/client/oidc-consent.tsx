'use client'

import { Suspense, useEffect, useMemo, useState, type CSSProperties, type ReactNode, type SVGProps } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  IconAlertCircle,
  IconCheck,
  IconFileText,
  IconMail,
  IconShield,
  IconSpinner,
  IconUser,
  IconX,
} from './form-icons.js'
import { LocksmithFormShell, LocksmithFormSurface } from './form-shell.js'
import type { LocksmithFormClassNames, LocksmithFormThemeId } from './form-theme.js'
import {
  cardDescriptionStyle,
  cardHeaderStyle,
  cardTitleStyle,
  errorStyle,
  mergeFormClasses,
  outlineButtonStyle,
  primaryButtonStyle,
  sectionStackStyle,
} from './form-theme.js'
import { useLocksmithAuth, useLocksmithPoweredBy } from './provider.js'

type ScopeIcon = (props: SVGProps<SVGSVGElement>) => React.JSX.Element

const SCOPE_LABELS: Record<string, { label: string; icon: ScopeIcon; description: string }> = {
  openid: {
    label:       'Sign you in',
    icon:        IconShield,
    description: 'Required for authentication',
  },
  email: {
    label:       'Email address',
    icon:        IconMail,
    description: 'Access to your email',
  },
  profile: {
    label:       'Profile information',
    icon:        IconUser,
    description: 'Your name and profile details',
  },
}

function heroIconCircle(d: number, bg: string, color: string): CSSProperties {
  return {
    width:           d,
    height:          d,
    margin:          '0 auto 16px',
    borderRadius:    '50%',
    background:      bg,
    color,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  }
}

function consentHeroRingStyle(): CSSProperties {
  return {
    width:           56,
    height:          56,
    margin:          '0 auto 16px',
    borderRadius:    '50%',
    background:      'var(--ls-accent-soft)',
    color:           'var(--ls-accent)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    boxShadow:       '0 0 0 4px color-mix(in srgb, var(--ls-accent) 14%, transparent)',
  }
}

const codeChipStyle: CSSProperties = {
  fontFamily:   'ui-monospace, monospace',
  fontSize:     12,
  padding:      '2px 6px',
  borderRadius: 6,
  background:   'var(--ls-bg-subtle)',
  border:       '1px solid var(--ls-border)',
  color:        'var(--ls-text)',
}

export type OidcConsentProps = {
  theme?: LocksmithFormThemeId
  classNames?: LocksmithFormClassNames
  /** Additional class on the themed surface root. */
  className?: string
  signInSlot?: ReactNode
  onSuccess?: () => void
  onError?: (message: string) => void
}

function centeredBlockStyle(): CSSProperties {
  return {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '40px 8px',
    textAlign:      'center',
  }
}

function OidcConsentInner({
  theme = 'locksmith',
  classNames,
  className,
  signInSlot,
  onSuccess,
  onError,
}: OidcConsentProps) {
  const searchParams = useSearchParams()
  const requestToken = searchParams.get('request_token') ?? ''
  const appName        = searchParams.get('app_name') ?? 'An application'
  const scopeRaw       = searchParams.get('scope') ?? 'openid'

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

  const mergedRoot = mergeFormClasses(classNames?.root, className)

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
      <LocksmithFormSurface theme={theme} className={mergedRoot}>
        <div style={heroIconCircle(48, 'var(--ls-error-muted)', 'var(--ls-error)')}>
          <IconAlertCircle width={24} height={24} />
        </div>
        <header style={cardHeaderStyle()}>
          <h2 style={cardTitleStyle()}>Invalid link</h2>
          <p style={cardDescriptionStyle()}>
            Missing <span style={codeChipStyle}>request_token</span>
          </p>
        </header>
        <p role="alert" style={{ ...errorStyle(), margin: 0, textAlign: 'center' }}>
          This page must be opened from your Locksmith OIDC authorization flow.
        </p>
      </LocksmithFormSurface>
    )
  }

  if (loading) {
    return (
      <LocksmithFormSurface theme={theme} className={mergedRoot}>
        <div style={centeredBlockStyle()}>
          <IconSpinner size={32} />
          <p style={{ fontSize: 14, color: 'var(--ls-muted)', margin: '16px 0 0' }}>Loading…</p>
        </div>
      </LocksmithFormSurface>
    )
  }

  if (pendingTotpToken) {
    const pendingBg   = 'color-mix(in srgb, var(--ls-strength-mid) 18%, transparent)'
    const pendingColor = 'var(--ls-strength-mid)'
    return (
      <LocksmithFormSurface theme={theme} className={mergedRoot}>
        <div style={heroIconCircle(48, pendingBg, pendingColor)}>
          <IconShield width={24} height={24} />
        </div>
        <header style={cardHeaderStyle()}>
          <h2 style={cardTitleStyle()}>Two-factor required</h2>
          <p style={cardDescriptionStyle()}>
            Complete two-factor authentication first, then return here to approve access.
          </p>
        </header>
      </LocksmithFormSurface>
    )
  }

  if (!user) {
    return (
      <LocksmithFormShell
        theme={theme}
        classNames={{ ...classNames, root: mergedRoot }}
        poweredByLocksmith={poweredBy}
      >
        <div style={sectionStackStyle()}>
          <div style={heroIconCircle(48, 'var(--ls-accent-soft)', 'var(--ls-accent)')}>
            <IconShield width={24} height={24} />
          </div>
          <header style={cardHeaderStyle()}>
            <h2 style={cardTitleStyle()}>Sign in required</h2>
            <p style={cardDescriptionStyle()}>
              <strong style={{ color: 'var(--ls-text)' }}>{appName}</strong> wants to access your account.
            </p>
          </header>
          <p
            style={{
              margin:     0,
              fontSize:   14,
              lineHeight: 1.5,
              color:      'var(--ls-muted)',
              textAlign:  'center',
            }}
          >
            Sign in to review permissions and continue.
          </p>
          {signInSlot ?? (
            <p
              style={{
                margin:       0,
                fontSize:     13,
                lineHeight:   1.45,
                color:        'var(--ls-faint)',
                textAlign:    'center',
                padding:      '12px 14px',
                borderRadius: 10,
                border:       '1px solid var(--ls-border)',
                background:   'var(--ls-bg-subtle)',
              }}
            >
              Add your sign-in UI via the <span style={codeChipStyle}>signInSlot</span> prop, or send users to
              your login page and back to this URL.
            </p>
          )}
        </div>
      </LocksmithFormShell>
    )
  }

  return (
    <LocksmithFormShell
      theme={theme}
      classNames={{ ...classNames, root: mergedRoot }}
      poweredByLocksmith={poweredBy}
    >
      <div style={sectionStackStyle()}>
        <div style={consentHeroRingStyle()}>
          <IconShield width={28} height={28} />
        </div>
        <header style={cardHeaderStyle()}>
          <h2 style={cardTitleStyle()}>Approve access</h2>
          <p style={cardDescriptionStyle()}>
            Allow <strong style={{ color: 'var(--ls-text)' }}>{appName}</strong> to access your account?
          </p>
        </header>

        <div
          style={{
            display:       'flex',
            alignItems:    'center',
            gap:           12,
            padding:       '12px 16px',
            borderRadius:  10,
            border:        '1px solid var(--ls-border)',
            background:    'var(--ls-bg-subtle)',
          }}
        >
          <div
            style={{
              width:           40,
              height:          40,
              borderRadius:    '50%',
              background:      'var(--ls-accent-soft)',
              color:           'var(--ls-accent)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              flexShrink:      0,
            }}
          >
            <IconUser width={18} height={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ls-muted)' }}>Signed in as</p>
            <p
              style={{
                margin:     0,
                fontSize:   14,
                fontWeight: 600,
                color:      'var(--ls-text)',
                overflow:   'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user.email}
            </p>
          </div>
          <span style={{ color: 'var(--ls-strength-high)', display: 'flex', flexShrink: 0 }} aria-hidden>
            <IconCheck width={18} height={18} strokeWidth={2.5} />
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ls-text)' }}>
            This application is requesting:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requested.map((s) => {
              const scope       = SCOPE_LABELS[s] ?? {
                label:       s,
                icon:        IconFileText,
                description: 'Additional permission',
              }
              const Icon        = scope.icon
              const isRequired  = s === 'openid'
              const isChecked   = isRequired || selected.has(s)
              const rowActive   = isChecked && !isRequired

              return (
                <label
                  key={s}
                  style={{
                    display:     'flex',
                    alignItems:  'center',
                    gap:         12,
                    padding:     '12px 16px',
                    borderRadius: 10,
                    border:      '1px solid',
                    borderColor: rowActive
                      ? 'color-mix(in srgb, var(--ls-accent) 42%, var(--ls-border))'
                      : 'var(--ls-border)',
                    background: rowActive ? 'var(--ls-accent-soft)' : 'var(--ls-bg-elevated)',
                    cursor:      isRequired ? 'default' : busy ? 'not-allowed' : 'pointer',
                    opacity:     busy && !isRequired ? 0.85 : 1,
                    transition:  'background 0.15s ease, border-color 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isRequired || busy}
                    onChange={() => {
                      toggleScope(s)
                    }}
                    style={{
                      width:        18,
                      height:       18,
                      flexShrink:   0,
                      accentColor:  'var(--ls-accent)',
                      cursor:       isRequired ? 'default' : 'pointer',
                    }}
                  />
                  <div
                    style={{
                      width:           36,
                      height:          36,
                      borderRadius:    8,
                      background:      'var(--ls-bg-subtle)',
                      color:           'var(--ls-muted)',
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                      flexShrink:      0,
                    }}
                  >
                    <Icon width={16} height={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ls-text)' }}>
                      {scope.label}
                      {isRequired ? (
                        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--ls-muted)' }}>
                          (Required)
                        </span>
                      ) : null}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.4, color: 'var(--ls-muted)' }}>
                      {scope.description}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {error ? (
          <p role="alert" className={classNames?.error} style={{ ...errorStyle(), margin: 0 }}>
            {error}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={busy}
            className={classNames?.button}
            style={{ ...outlineButtonStyle(busy), flex: '1 1 120px', width: 'auto' }}
            onClick={() => void finish(false)}
          >
            {busy ? <IconSpinner size={18} /> : <IconX width={18} height={18} strokeLinejoin="round" />}
            Deny
          </button>
          <button
            type="button"
            disabled={busy}
            className={classNames?.button}
            style={{ ...primaryButtonStyle(busy), flex: '1 1 120px', width: 'auto' }}
            onClick={() => void finish(true)}
          >
            {busy ? <IconSpinner size={18} /> : <IconShield width={18} height={18} />}
            Allow
          </button>
        </div>
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
  const mergedFallbackRoot = mergeFormClasses(props.classNames?.root, props.className)
  return (
    <Suspense
      fallback={
        <LocksmithFormSurface theme={props.theme ?? 'locksmith'} className={mergedFallbackRoot}>
          <div style={centeredBlockStyle()}>
            <IconSpinner size={32} />
            <p style={{ fontSize: 14, color: 'var(--ls-muted)', margin: '16px 0 0' }}>Loading…</p>
          </div>
        </LocksmithFormSurface>
      }
    >
      <OidcConsentInner {...props} />
    </Suspense>
  )
}
