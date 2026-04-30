'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { LocksmithAuthError } from '../error.js'
import type { UserMe } from '../types.js'
import { isSignInRequiresTotp } from '../types.js'
import { LocksmithBffClient, type LocksmithBffClientOptions } from './bff-client.js'

export type SignInWithPasswordResult = 'signed_in' | 'needs_totp'

export type LocksmithAuthContextValue = {
  user: UserMe | null
  loading: boolean
  error: string | null
  /** When set, call `completeTotp` with the authenticator code. */
  pendingTotpToken: string | null
  /** True when the Locksmith project owner is on the Free plan — SDK forms show “Powered by Locksmith”. */
  poweredByLocksmith: boolean
  refreshSession: () => Promise<void>
  /**
   * Returns `needs_totp` when MFA is required. On failure, sets context `error` and throws `LocksmithAuthError`.
   */
  signInWithPassword: (email: string, password: string) => Promise<SignInWithPasswordResult>
  /** On failure, sets context `error` and throws `LocksmithAuthError`. */
  completeTotp: (code: string) => Promise<void>
  /** On failure, sets context `error` and throws `LocksmithAuthError`. */
  signUp: (email: string, password: string, meta?: Record<string, unknown>) => Promise<void>
  signOut: () => Promise<void>
  /**
   * Social OAuth: requests the provider URL then sets `window.location` (full redirect).
   * `redirectUrl` is where the user returns with `?code=` (your callback page that calls
   * `completeOAuthExchange` or mounts `LocksmithOAuthCallback`).
   * On failure before redirect, sets context `error` and throws `LocksmithAuthError`.
   */
  startOAuth: (provider: string, redirectUrl?: string) => Promise<void>
  /** After OAuth redirect, redeem `code` from the query string and refresh the session. */
  completeOAuthExchange: (code: string) => Promise<void>
  /**
   * OIDC consent: approve or deny. Returns `redirectUrl` from Locksmith — assign
   * `window.location.href` to send the user back to the OIDC client.
   */
  completeOidcConsent: (params: {
    requestToken: string
    approved: boolean
    scopes?: string[]
  }) => Promise<string>
}

const LocksmithAuthContext = createContext<LocksmithAuthContextValue | null>(null)

export type LocksmithAuthProviderProps = {
  children: ReactNode
} & LocksmithBffClientOptions

export function LocksmithAuthProvider({
  children,
  origin,
  routePrefix,
}: LocksmithAuthProviderProps) {
  const client = useMemo(
    () => new LocksmithBffClient({ origin, routePrefix }),
    [origin, routePrefix],
  )

  const [user, setUser]             = useState<UserMe | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [pendingTotpToken, setTotp] = useState<string | null>(null)
  const [poweredByLocksmith, setPoweredBy] = useState(false)

  const refreshSession = useCallback(async () => {
    setError(null)
    try {
      const { user: u, poweredByLocksmith: pb } = await client.session()
      setUser(u)
      setPoweredBy(pb)
    } catch (e) {
      if (e instanceof LocksmithAuthError) {
        setError(e.message)
      } else {
        setError('Failed to load session')
      }
      setUser(null)
      setPoweredBy(false)
    }
  }, [client])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      await refreshSession()
      setLoading(false)
    })()
  }, [refreshSession])

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<SignInWithPasswordResult> => {
      setError(null)
      setTotp(null)
      try {
        const r = await client.signIn(email, password)
        if (isSignInRequiresTotp(r)) {
          setTotp(r.twoFactorToken)
          return 'needs_totp'
        }
        setUser(r.user as UserMe)
        await refreshSession()
        return 'signed_in'
      } catch (e) {
        const msg = e instanceof LocksmithAuthError ? e.message : 'Sign in failed'
        setError(msg)
        if (e instanceof LocksmithAuthError) {
          throw e
        }
        throw new LocksmithAuthError('sign_in_failed', msg, 400)
      }
    },
    [client, refreshSession],
  )

  const completeTotp = useCallback(
    async (code: string) => {
      if (!pendingTotpToken) {
        const msg = 'No pending two-factor challenge.'
        setError(msg)
        throw new LocksmithAuthError('totp_state', msg, 400)
      }
      setError(null)
      try {
        const r = await client.completeTotp(pendingTotpToken, code)
        setTotp(null)
        setUser(r.user as UserMe)
        await refreshSession()
      } catch (e) {
        const msg = e instanceof LocksmithAuthError ? e.message : 'Verification failed'
        setError(msg)
        if (e instanceof LocksmithAuthError) {
          throw e
        }
        throw new LocksmithAuthError('totp_failed', msg, 400)
      }
    },
    [client, pendingTotpToken, refreshSession],
  )

  const signUp = useCallback(
    async (email: string, password: string, meta?: Record<string, unknown>) => {
      setError(null)
      try {
        await client.signUp({ email, password, meta })
        await refreshSession()
      } catch (e) {
        const msg = e instanceof LocksmithAuthError ? e.message : 'Sign up failed'
        setError(msg)
        if (e instanceof LocksmithAuthError) {
          throw e
        }
        throw new LocksmithAuthError('sign_up_failed', msg, 400)
      }
    },
    [client, refreshSession],
  )

  const signOut = useCallback(async () => {
    setError(null)
    setTotp(null)
    try {
      await client.signOut()
    } catch {
      /* still clear local state */
    }
    setUser(null)
  }, [client])

  const startOAuth = useCallback(
    async (provider: string, redirectUrl?: string) => {
      setError(null)
      try {
        const { authorizationUrl } = await client.initiateOAuth(provider, redirectUrl)
        window.location.href = authorizationUrl
      } catch (e) {
        const msg = e instanceof LocksmithAuthError ? e.message : 'Could not start OAuth'
        setError(msg)
        if (e instanceof LocksmithAuthError) {
          throw e
        }
        throw new LocksmithAuthError('oauth_start_failed', msg, 400)
      }
    },
    [client],
  )

  const completeOAuthExchange = useCallback(
    async (code: string) => {
      setError(null)
      try {
        const r = await client.exchangeOAuthCode(code)
        setUser(r.user as UserMe)
        await refreshSession()
      } catch (e) {
        const msg = e instanceof LocksmithAuthError ? e.message : 'Could not complete sign-in'
        setError(msg)
        if (e instanceof LocksmithAuthError) {
          throw e
        }
        throw new LocksmithAuthError('oauth_exchange_failed', msg, 400)
      }
    },
    [client, refreshSession],
  )

  const completeOidcConsent = useCallback(
    async (params: { requestToken: string; approved: boolean; scopes?: string[] }) => {
      setError(null)
      try {
        const { redirectUrl } = await client.oidcGrant(params)
        return redirectUrl
      } catch (e) {
        const msg = e instanceof LocksmithAuthError ? e.message : 'Could not complete authorization'
        setError(msg)
        if (e instanceof LocksmithAuthError) {
          throw e
        }
        throw new LocksmithAuthError('oidc_grant_failed', msg, 400)
      }
    },
    [client],
  )

  const value = useMemo<LocksmithAuthContextValue>(
    () => ({
      user,
      loading,
      error,
      pendingTotpToken,
      poweredByLocksmith,
      refreshSession,
      signInWithPassword,
      completeTotp,
      signUp,
      signOut,
      startOAuth,
      completeOAuthExchange,
      completeOidcConsent,
    }),
    [
      user,
      loading,
      error,
      pendingTotpToken,
      poweredByLocksmith,
      refreshSession,
      signInWithPassword,
      completeTotp,
      signUp,
      signOut,
      startOAuth,
      completeOAuthExchange,
      completeOidcConsent,
    ],
  )

  return (
    <LocksmithAuthContext.Provider value={value}>{children}</LocksmithAuthContext.Provider>
  )
}

export function useLocksmithAuth(): LocksmithAuthContextValue {
  const ctx = useContext(LocksmithAuthContext)
  if (!ctx) {
    throw new Error('useLocksmithAuth must be used within LocksmithAuthProvider')
  }
  return ctx
}

/** Outside `LocksmithAuthProvider`, always returns false. */
export function useLocksmithPoweredBy(): boolean {
  const ctx = useContext(LocksmithAuthContext)
  return ctx?.poweredByLocksmith === true
}
