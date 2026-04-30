'use client'

import { useState, type ReactNode } from 'react'
import {
  IconArrowRight,
  IconEye,
  IconEyeOff,
  IconLock,
  IconMail,
  IconSpinner,
} from './form-icons.js'
import type { LocksmithFormClassNames, LocksmithFormThemeId } from './form-theme.js'
import {
  cardDescriptionStyle,
  cardHeaderStyle,
  cardTitleStyle,
  errorStyle,
  fieldLabelRowStyle,
  fieldSeparatorLabelStyle,
  fieldSeparatorLineStyle,
  fieldSeparatorRowStyle,
  footerLinksStyle,
  forgotPasswordLinkStyle,
  formBlockStackStyle,
  inputIconLeftStyle,
  inputIconRowStyle,
  inputStyleLarge,
  labelStyle,
  linkAccentStyle,
  passwordToggleStyle,
  primaryButtonStyle,
  sectionStackStyle,
} from './form-theme.js'
import { LocksmithFormShell } from './form-shell.js'
import {
  LocksmithSocialButtonGroup,
  type SocialProvider,
} from './social-buttons.js'
import { useLocksmithAuth, useLocksmithPoweredBy } from './provider.js'

function FieldSeparator({ children }: { children: ReactNode }) {
  return (
    <div style={fieldSeparatorRowStyle()}>
      <div style={fieldSeparatorLineStyle()} />
      <span style={fieldSeparatorLabelStyle()}>{children}</span>
      <div style={fieldSeparatorLineStyle()} />
    </div>
  )
}

export type SignInFormProps = {
  theme?: LocksmithFormThemeId
  classNames?: LocksmithFormClassNames
  title?: string
  description?: string
  emailLabel?: string
  passwordLabel?: string
  submitLabel?: string
  forgotPasswordLabel?: string
  forgotPasswordHref?: string
  signUpLabel?: string
  signUpHref?: string
  signUpLinkText?: string
  socialProviders?: SocialProvider[]
  /** When omitted and `socialProviders` is set, `startOAuth(provider, oauthRedirectUrl)` is used. */
  onSocialLogin?: (provider: SocialProvider) => void
  oauthRedirectUrl?: string
  showSocialDivider?: boolean
  /** Called when password sign-in completes and the user is signed in (not when MFA is required). */
  onSuccess?: () => void
  onError?: (message: string) => void
}

export function LocksmithSignInForm({
  theme                 = 'locksmith',
  classNames,
  title                 = 'Welcome back',
  description           = 'Enter your credentials to access your account',
  emailLabel            = 'Email address',
  passwordLabel         = 'Password',
  submitLabel           = 'Sign in',
  forgotPasswordLabel   = 'Forgot password?',
  forgotPasswordHref    = '/forgot-password',
  signUpLabel           = "Don't have an account?",
  signUpHref            = '/sign-up',
  signUpLinkText        = 'Create account',
  socialProviders       = [],
  onSocialLogin,
  oauthRedirectUrl,
  showSocialDivider     = true,
  onSuccess,
  onError,
}: SignInFormProps) {
  const { signInWithPassword, startOAuth, error, loading } = useLocksmithAuth()
  const poweredByLocksmith                                = useLocksmithPoweredBy()
  const [showPassword, setShowPassword]                    = useState(false)
  const [socialLoading, setSocialLoading]                = useState<SocialProvider | null>(null)

  const hasSocial = socialProviders.length > 0

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      const outcome = await signInWithPassword(
        String(fd.get('email') ?? ''),
        String(fd.get('password') ?? ''),
      )
      if (outcome === 'signed_in') {
        onSuccess?.()
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Sign in failed')
    }
  }

  async function handleSocial(provider: SocialProvider) {
    setSocialLoading(provider)
    try {
      if (onSocialLogin) {
        onSocialLogin(provider)
      } else {
        await startOAuth(provider, oauthRedirectUrl)
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'OAuth failed')
    } finally {
      setSocialLoading(null)
    }
  }

  const emailId  = 'locksmith-signin-email'
  const passId   = 'locksmith-signin-password'
  const passRightPad = showPassword ? 40 : 12

  return (
    <LocksmithFormShell
      theme={theme}
      classNames={classNames}
      poweredByLocksmith={poweredByLocksmith}
    >
      <div style={sectionStackStyle()}>
        <header style={cardHeaderStyle()}>
          <h2 style={cardTitleStyle()}>{title}</h2>
          <p style={cardDescriptionStyle()}>{description}</p>
        </header>

        <div style={sectionStackStyle()}>
          {hasSocial ? (
            <LocksmithSocialButtonGroup
              providers={socialProviders}
              onProviderClick={(p) => {
                void handleSocial(p)
              }}
              disabled={loading}
              loading={socialLoading}
              iconOnly={socialProviders.length > 3}
            />
          ) : null}

          {hasSocial && showSocialDivider ? (
            <FieldSeparator>or continue with email</FieldSeparator>
          ) : null}

          <form onSubmit={(e) => void onSubmit(e)} style={formBlockStackStyle()}>
            {error ? (
              <p role="alert" className={classNames?.error} style={errorStyle()}>
                {error}
              </p>
            ) : null}

            <div style={{ ...labelStyle(), gap: 8 }} className={classNames?.label}>
              <span>{emailLabel}</span>
              <div style={inputIconRowStyle()}>
                <span style={inputIconLeftStyle()}>
                  <IconMail />
                </span>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  className={classNames?.input}
                  style={inputStyleLarge(40, 12)}
                />
              </div>
            </div>

            <div style={{ ...labelStyle(), gap: 8 }} className={classNames?.label}>
              <div style={fieldLabelRowStyle()}>
                <label htmlFor={passId} style={{ margin: 0, cursor: 'pointer' }}>
                  {passwordLabel}
                </label>
                {forgotPasswordHref ? (
                  <a href={forgotPasswordHref} style={forgotPasswordLinkStyle()}>
                    {forgotPasswordLabel}
                  </a>
                ) : null}
              </div>
              <div style={inputIconRowStyle()}>
                <span style={inputIconLeftStyle()}>
                  <IconLock />
                </span>
                <input
                  id={passId}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  className={classNames?.input}
                  style={inputStyleLarge(40, passRightPad)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={passwordToggleStyle()}
                  onClick={() => {
                    setShowPassword((v) => !v)
                  }}
                >
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={classNames?.button}
              style={primaryButtonStyle(loading)}
            >
              {loading ? (
                <>
                  <IconSpinner size={18} />
                  Signing in…
                </>
              ) : (
                <>
                  {submitLabel}
                  <IconArrowRight />
                </>
              )}
            </button>
          </form>
        </div>

        {signUpHref ? (
          <p style={footerLinksStyle()}>
            {signUpLabel}{' '}
            <a href={signUpHref} style={linkAccentStyle()}>
              {signUpLinkText}
            </a>
          </p>
        ) : null}
      </div>
    </LocksmithFormShell>
  )
}
