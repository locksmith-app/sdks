'use client'

import { Suspense, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { IconAlertCircle, IconCheck, IconSpinner } from './form-icons.js'
import { LocksmithFormSurface } from './form-shell.js'
import type { LocksmithFormClassNames, LocksmithFormThemeId } from './form-theme.js'
import {
  cardDescriptionStyle,
  cardHeaderStyle,
  cardTitleStyle,
  errorStyle,
  mergeFormClasses,
} from './form-theme.js'
import { useLocksmithAuth } from './provider.js'

const OAUTH_DOT_KEYFRAMES = `@keyframes ls-oauth-dot{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(1.12)}}`

function heroRingBase(): CSSProperties {
  return {
    width:          56,
    height:         56,
    margin:         '0 auto 16px',
    borderRadius:   '50%',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  }
}

function loadingHeroStyle(): CSSProperties {
  return {
    ...heroRingBase(),
    background: 'var(--ls-accent-soft)',
    color:      'var(--ls-accent)',
    boxShadow:  '0 0 0 4px color-mix(in srgb, var(--ls-accent) 14%, transparent)',
  }
}

function errorHeroStyle(): CSSProperties {
  return {
    ...heroRingBase(),
    background: 'var(--ls-error-muted)',
    color:      'var(--ls-error)',
    boxShadow:  '0 0 0 4px color-mix(in srgb, var(--ls-error) 14%, transparent)',
  }
}

function successHeroStyle(): CSSProperties {
  return {
    ...heroRingBase(),
    background: 'color-mix(in srgb, var(--ls-strength-high) 18%, transparent)',
    color:      'var(--ls-strength-high)',
    boxShadow:  '0 0 0 4px color-mix(in srgb, var(--ls-strength-high) 14%, transparent)',
  }
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

function oauthDotStyle(delayMs: number): CSSProperties {
  return {
    width:        8,
    height:       8,
    borderRadius: '50%',
    background:   'var(--ls-accent)',
    animation:    `ls-oauth-dot 1.2s ease-in-out ${delayMs}ms infinite`,
  }
}

export type LocksmithOAuthCallbackProps = {
  theme?: LocksmithFormThemeId
  classNames?: LocksmithFormClassNames
  /** Merged with `classNames.root` on the themed surface. */
  className?: string
  /** After a successful exchange, client navigates here (default `/`). */
  redirectTo?: string
  onSuccess?: () => void
  onError?: (message: string) => void
  title?: string
  description?: string
  successTitle?: string
  successDescription?: string
  errorTitle?: string
  errorDescription?: string
}

function OAuthCallbackInner({
  theme = 'locksmith',
  classNames,
  className,
  redirectTo = '/',
  onSuccess,
  onError,
  title = 'Completing sign in',
  description = 'Please wait while we verify your credentials…',
  successTitle = 'Success!',
  successDescription = 'You have been signed in. Redirecting…',
  errorTitle = 'Sign in failed',
  errorDescription = 'There was a problem signing you in',
}: LocksmithOAuthCallbackProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get('code')
  const { completeOAuthExchange, error } = useLocksmithAuth()
  const [localError, setLocalError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  onSuccessRef.current = onSuccess
  onErrorRef.current = onError

  const mergedRoot = mergeFormClasses(classNames?.root, className)

  useEffect(() => {
    if (!code) {
      const msg = 'Missing authorization code.'
      setLocalError(msg)
      onErrorRef.current?.(msg)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        await completeOAuthExchange(code)
        if (!cancelled) {
          setSuccess(true)
          onSuccessRef.current?.()
          setTimeout(() => {
            router.replace(redirectTo)
          }, 500)
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Could not complete sign-in'
          setLocalError(msg)
          onErrorRef.current?.(msg)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, completeOAuthExchange, redirectTo, router])

  const msg = localError ?? error

  if (msg) {
    return (
      <LocksmithFormSurface theme={theme} className={mergedRoot}>
        <div style={errorHeroStyle()}>
          <IconAlertCircle width={28} height={28} />
        </div>
        <header style={cardHeaderStyle()}>
          <h2 style={cardTitleStyle()}>{errorTitle}</h2>
          <p style={cardDescriptionStyle()}>{errorDescription}</p>
        </header>
        <p role="alert" className={classNames?.error} style={{ ...errorStyle(), margin: 0, textAlign: 'center' }}>
          {msg}
        </p>
      </LocksmithFormSurface>
    )
  }

  if (success) {
    return (
      <LocksmithFormSurface theme={theme} className={mergedRoot}>
        <div style={successHeroStyle()}>
          <IconCheck width={28} height={28} strokeWidth={2} />
        </div>
        <header style={cardHeaderStyle()}>
          <h2 style={cardTitleStyle()}>{successTitle}</h2>
          <p style={cardDescriptionStyle()}>{successDescription}</p>
        </header>
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            8,
            marginTop:      8,
          }}
        >
          <IconSpinner size={16} />
          <span style={{ fontSize: 14, color: 'var(--ls-muted)' }}>Redirecting…</span>
        </div>
      </LocksmithFormSurface>
    )
  }

  return (
    <LocksmithFormSurface theme={theme} className={mergedRoot}>
      <style>{OAUTH_DOT_KEYFRAMES}</style>
      <div style={loadingHeroStyle()}>
        <IconSpinner size={28} />
      </div>
      <header style={cardHeaderStyle()}>
        <h2 style={cardTitleStyle()}>{title}</h2>
        <p style={cardDescriptionStyle()}>{description}</p>
      </header>
      <div
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          gap:            16,
          marginTop:      8,
        }}
      >
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={oauthDotStyle(i * 150)} />
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ls-muted)' }}>This may take a few seconds</p>
      </div>
    </LocksmithFormSurface>
  )
}

/**
 * Call on a dedicated route (e.g. `/auth/callback`) that receives `?code=` from Locksmith after social OAuth.
 * Must render inside `LocksmithAuthProvider`. Wrapped in `Suspense` for `useSearchParams`.
 */
export function LocksmithOAuthCallback(props: LocksmithOAuthCallbackProps) {
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
      <OAuthCallbackInner {...props} />
    </Suspense>
  )
}
