'use client'

import { useState, type ReactNode } from 'react'
import {
  IconArrowRight,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconLock,
  IconMail,
  IconSpinner,
  IconUser,
  IconX,
} from './form-icons.js'
import type { LocksmithFormClassNames, LocksmithFormThemeId } from './form-theme.js'
import {
  cardDescriptionStyle,
  cardHeaderStyle,
  cardTitleStyle,
  errorStyle,
  footerLinksStyle,
  formBlockStackStyle,
  inputIconLeftStyle,
  inputIconRowStyle,
  inputStyleLarge,
  labelStyle,
  linkAccentStyle,
  passwordToggleStyle,
  primaryButtonStyle,
  sectionStackStyle,
  fieldSeparatorLabelStyle,
  fieldSeparatorLineStyle,
  fieldSeparatorRowStyle,
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

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', valid: password.length >= 8 },
    { label: 'One uppercase letter', valid: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', valid: /[a-z]/.test(password) },
    { label: 'One number', valid: /\d/.test(password) },
  ]
  const strength = checks.filter((c) => c.valid).length
  if (!password) return null

  const bar = (level: number) => {
    const filled = strength >= level
    let bg = 'var(--ls-strength-track)'
    if (filled) {
      if (strength === 4) bg = 'var(--ls-strength-high)'
      else if (strength >= 3) bg = 'var(--ls-strength-mid)'
      else bg = 'var(--ls-strength-low)'
    }
    return (
      <div
        key={level}
        style={{
          height:        6,
          flex:          1,
          borderRadius:  999,
          background:    bg,
          transition:    'background 0.2s ease',
        }}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 4 }}>{[1, 2, 3, 4].map((l) => bar(l))}</div>
      <div
        style={{
          display:               'grid',
          gridTemplateColumns:   '1fr 1fr',
          gap:                   6,
        }}
      >
        {checks.map((check) => (
          <div
            key={check.label}
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        6,
              fontSize:   12,
              color:      check.valid ? 'var(--ls-strength-high)' : 'var(--ls-faint)',
              transition: 'color 0.2s ease',
            }}
          >
            <span style={{ display: 'flex', color: 'inherit' }}>
              {check.valid ? <IconCheck /> : <IconX />}
            </span>
            <span>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export type SignUpFormProps = {
  theme?: LocksmithFormThemeId
  classNames?: LocksmithFormClassNames
  title?: string
  description?: string
  nameLabel?: string
  emailLabel?: string
  passwordLabel?: string
  confirmPasswordLabel?: string
  submitLabel?: string
  signInLabel?: string
  signInHref?: string
  signInLinkText?: string
  showNameField?: boolean
  showConfirmPassword?: boolean
  showPasswordStrength?: boolean
  termsText?: ReactNode
  socialProviders?: SocialProvider[]
  onSocialLogin?: (provider: SocialProvider) => void
  oauthRedirectUrl?: string
  showSocialDivider?: boolean
  onSuccess?: () => void
  onError?: (message: string) => void
}

export function LocksmithSignUpForm({
  theme                   = 'locksmith',
  classNames,
  title                   = 'Create an account',
  description             = 'Enter your details to get started',
  nameLabel               = 'Full name',
  emailLabel              = 'Email address',
  passwordLabel           = 'Password',
  confirmPasswordLabel    = 'Confirm password',
  submitLabel             = 'Create account',
  signInLabel             = 'Already have an account?',
  signInHref              = '/sign-in',
  signInLinkText          = 'Sign in',
  showNameField           = false,
  showConfirmPassword     = false,
  showPasswordStrength    = true,
  termsText,
  socialProviders         = [],
  onSocialLogin,
  oauthRedirectUrl,
  showSocialDivider       = true,
  onSuccess,
  onError,
}: SignUpFormProps) {
  const { signUp, startOAuth, error, loading } = useLocksmithAuth()
  const poweredByLocksmith                     = useLocksmithPoweredBy()
  const [showPassword, setShowPassword]         = useState(false)
  const [password, setPassword]                 = useState('')
  const [confirmPassword, setConfirmPassword]   = useState('')
  const [socialLoading, setSocialLoading]      = useState<SocialProvider | null>(null)
  const [formError, setFormError]              = useState<string | null>(null)

  const hasSocial = socialProviders.length > 0
  const displayError = formError || error

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    const fd       = new FormData(e.currentTarget)
    const email    = String(fd.get('email') ?? '')
    const pwd      = String(fd.get('password') ?? '')
    const confirmP = String(fd.get('confirmPassword') ?? '')
    const name     = String(fd.get('name') ?? '')

    if (showConfirmPassword && pwd !== confirmP) {
      const msg = 'Passwords do not match'
      setFormError(msg)
      onError?.(msg)
      return
    }

    const meta: Record<string, unknown> = {}
    if (showNameField && name) {
      meta.name = name
    }

    try {
      await signUp(email, pwd, Object.keys(meta).length > 0 ? meta : undefined)
      onSuccess?.()
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Sign up failed')
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

  const nameId     = 'locksmith-signup-name'
  const emailId    = 'locksmith-signup-email'
  const passId     = 'locksmith-signup-password'
  const confirmId  = 'locksmith-signup-confirm'
  const passRightPad = showPassword ? 40 : 12
  const mismatch =
    showConfirmPassword &&
    confirmPassword.length > 0 &&
    password !== confirmPassword

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
            {displayError ? (
              <p role="alert" className={classNames?.error} style={errorStyle()}>
                {displayError}
              </p>
            ) : null}

            {showNameField ? (
              <div style={{ ...labelStyle(), gap: 8 }} className={classNames?.label}>
                <label htmlFor={nameId}>{nameLabel}</label>
                <div style={inputIconRowStyle()}>
                  <span style={inputIconLeftStyle()}>
                    <IconUser />
                  </span>
                  <input
                    id={nameId}
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="John Doe"
                    className={classNames?.input}
                    style={inputStyleLarge(40, 12)}
                  />
                </div>
              </div>
            ) : null}

            <div style={{ ...labelStyle(), gap: 8 }} className={classNames?.label}>
              <label htmlFor={emailId}>{emailLabel}</label>
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
              <label htmlFor={passId}>{passwordLabel}</label>
              <div style={inputIconRowStyle()}>
                <span style={inputIconLeftStyle()}>
                  <IconLock />
                </span>
                <input
                  id={passId}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(ev) => {
                    setPassword(ev.target.value)
                  }}
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
              {showPasswordStrength ? <PasswordStrength password={password} /> : null}
            </div>

            {showConfirmPassword ? (
              <div style={{ ...labelStyle(), gap: 8 }} className={classNames?.label}>
                <label htmlFor={confirmId}>{confirmPasswordLabel}</label>
                <div style={inputIconRowStyle()}>
                  <span style={inputIconLeftStyle()}>
                    <IconLock />
                  </span>
                  <input
                    id={confirmId}
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    required
                    value={confirmPassword}
                    onChange={(ev) => {
                      setConfirmPassword(ev.target.value)
                    }}
                    className={classNames?.input}
                    style={{
                      ...inputStyleLarge(40, 12),
                      ...(mismatch
                        ? {
                            borderColor: 'var(--ls-error)',
                          }
                        : {}),
                    }}
                  />
                </div>
              </div>
            ) : null}

            {termsText ? (
              <p
                style={{
                  margin:     0,
                  fontSize:   12,
                  lineHeight: 1.45,
                  textAlign:  'center',
                  color:      'var(--ls-muted)',
                  textWrap:   'balance',
                }}
              >
                {termsText}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className={classNames?.button}
              style={primaryButtonStyle(loading)}
            >
              {loading ? (
                <>
                  <IconSpinner size={18} />
                  Creating account…
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

        {signInHref ? (
          <p style={footerLinksStyle()}>
            {signInLabel}{' '}
            <a href={signInHref} style={linkAccentStyle()}>
              {signInLinkText}
            </a>
          </p>
        ) : null}
      </div>
    </LocksmithFormShell>
  )
}
