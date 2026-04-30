'use client'

import { useState } from 'react'
import type { LocksmithFormClassNames, LocksmithFormThemeId } from './form-theme.js'
import { errorStyle, outlineButtonStyle } from './form-theme.js'
import { IconSpinner } from './form-icons.js'
import { LocksmithFormSurface } from './form-shell.js'
import { useLocksmithAuth, useLocksmithPoweredBy } from './provider.js'
import { LocksmithPoweredBy } from './powered-by.js'

export type OAuthSignInButtonProps = {
  provider: string
  /**
   * Absolute URL of the page that handles the OAuth return (`?code=`).
   * Example: `https://myapp.com/auth/callback` or a path on the same origin your app resolves to static `window.location.origin + '/auth/callback'`.
   */
  redirectUrl?: string
  theme?: LocksmithFormThemeId
  classNames?: LocksmithFormClassNames
  children?: React.ReactNode
  /** Runs only if the browser does not redirect (e.g. launch failed). */
  onSuccess?: () => void
  onError?: (message: string) => void
}

/**
 * Starts Locksmith **social OAuth** (GitHub, Google, …): POSTs the BFF, then redirects the browser to the provider.
 * Configure the provider and callback on the Locksmith dashboard; set `redirectUrl` to a route that mounts
 * `LocksmithOAuthCallback` (or calls `completeOAuthExchange`).
 */
export function LocksmithOAuthSignInButton({
  provider,
  redirectUrl,
  theme = 'locksmith',
  classNames,
  children,
  onSuccess,
  onError,
}: OAuthSignInButtonProps) {
  const { startOAuth, error } = useLocksmithAuth()
  const [busy, setBusy] = useState(false)
  const poweredBy = useLocksmithPoweredBy()

  return (
    <LocksmithFormSurface theme={theme}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error ? (
          <p
            role="alert"
            className={classNames?.error}
            style={errorStyle()}
          >
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          className={classNames?.button}
          style={outlineButtonStyle(busy)}
          onClick={() => {
            setBusy(true)
            void (async () => {
              try {
                await startOAuth(provider, redirectUrl)
                onSuccess?.()
              } catch (err) {
                onError?.(err instanceof Error ? err.message : 'Could not start OAuth')
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          {busy ? <IconSpinner size={20} /> : null}
          {children ?? `Continue with ${provider}`}
        </button>
        {poweredBy ? <LocksmithPoweredBy className={classNames?.poweredBy} /> : null}
      </div>
    </LocksmithFormSurface>
  )
}
