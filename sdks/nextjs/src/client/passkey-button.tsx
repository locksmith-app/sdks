'use client'

import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { useState } from 'react'
import { LocksmithAuthError } from '../error.js'
import type { LocksmithFormClassNames, LocksmithFormThemeId } from './form-theme.js'
import { errorStyle, outlineButtonStyle } from './form-theme.js'
import { LocksmithBffClient, type LocksmithBffClientOptions } from './bff-client.js'
import { IconFingerprint, IconSpinner } from './form-icons.js'
import { LocksmithFormSurface } from './form-shell.js'
import { LocksmithPoweredBy } from './powered-by.js'
import { useLocksmithPoweredBy } from './provider.js'

export type PasskeySignInButtonProps = {
  /** Must match the provider’s `origin` / `routePrefix` if you are not using defaults. */
  bff: LocksmithBffClientOptions
  email: string
  theme?: LocksmithFormThemeId
  classNames?: LocksmithFormClassNames
  className?: string
  children?: React.ReactNode
  onSuccess?: () => void
  onError?: (message: string) => void
}

/**
 * Passwordless sign-in. Install peer `@simplewebauthn/browser`.
 * Your app origin must be allowed in the Locksmith project’s CORS list.
 */
export function LocksmithPasskeySignInButton({
  bff,
  email,
  theme = 'locksmith',
  classNames,
  className,
  children = 'Sign in with passkey',
  onSuccess,
  onError,
}: PasskeySignInButtonProps) {
  const [busy, setBusy]   = useState(false)
  const [message, setMsg] = useState<string | null>(null)
  const poweredByHook     = useLocksmithPoweredBy()

  async function onClick() {
    setMsg(null)
    setBusy(true)
    try {
      const client   = new LocksmithBffClient(bff)
      const { startAuthentication } = await import('@simplewebauthn/browser')
      const { challengeId, options } = await client.passkeyLoginOptions(email)
      const response = await startAuthentication({
        optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON,
      })
      await client.passkeyLoginVerify({
        challengeId,
        email,
        response: response as unknown as Record<string, unknown>,
      })
      onSuccess?.()
      window.location.reload()
    } catch (e) {
      const msg =
        e instanceof LocksmithAuthError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Passkey sign-in failed'
      setMsg(msg)
      onError?.(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <LocksmithFormSurface theme={theme} className={className}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {message ? (
          <p role="alert" className={classNames?.error} style={errorStyle()}>
            {message}
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy || !email}
          className={classNames?.button}
          style={outlineButtonStyle(busy || !email)}
          onClick={() => void onClick()}
        >
          {busy ? <IconSpinner size={20} /> : <IconFingerprint />}
          {children}
        </button>
        {poweredByHook ? (
          <LocksmithPoweredBy className={classNames?.poweredBy} />
        ) : null}
      </div>
    </LocksmithFormSurface>
  )
}
