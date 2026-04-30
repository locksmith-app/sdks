'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { errorStyle } from './form-theme.js'
import { useLocksmithAuth } from './provider.js'

function OAuthCallbackInner({
  redirectTo,
  onSuccess,
  onError,
}: {
  redirectTo: string
  onSuccess?: () => void
  onError?: (message: string) => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get('code')
  const { completeOAuthExchange, error } = useLocksmithAuth()
  const [localError, setLocalError] = useState<string | null>(null)

  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  onSuccessRef.current = onSuccess
  onErrorRef.current = onError

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
          onSuccessRef.current?.()
          router.replace(redirectTo)
        }
      } catch (err) {
        if (!cancelled) {
          onErrorRef.current?.(
            err instanceof Error ? err.message : 'Could not complete sign-in',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, completeOAuthExchange, redirectTo, router])

  const msg = localError ?? error
  return msg ? (
    <p role="alert" style={errorStyle()}>
      {msg}
    </p>
  ) : (
    <p style={{ fontSize: 14, color: 'var(--ls-muted, #888)' }}>Completing sign-in…</p>
  )
}

export type LocksmithOAuthCallbackProps = {
  /** After a successful exchange, client navigates here (default `/`). */
  redirectTo?: string
  onSuccess?: () => void
  onError?: (message: string) => void
}

/**
 * Call on a dedicated route (e.g. `/auth/callback`) that receives `?code=` from Locksmith after social OAuth.
 * Must render inside `LocksmithAuthProvider` and be wrapped in `<Suspense>` at the page level for static generation.
 */
export function LocksmithOAuthCallback({
  redirectTo = '/',
  onSuccess,
  onError,
}: LocksmithOAuthCallbackProps) {
  return (
    <Suspense
      fallback={<p style={{ fontSize: 14, color: 'var(--ls-muted, #888)' }}>Loading…</p>}
    >
      <OAuthCallbackInner
        redirectTo={redirectTo}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Suspense>
  )
}
