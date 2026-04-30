'use client'

import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, User, Loader2, ArrowRight, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldLabel, FieldGroup, FieldSeparator } from '@/components/ui/field'
import { useLocksmithAuth, useLocksmithPoweredBy } from '@/lib/locksmith/provider'
import { LocksmithPoweredBy } from './powered-by'
import { SocialButtonGroup, type SocialProvider } from './social-buttons'

export type SignUpFormProps = {
  title?: string
  description?: string
  nameLabel?: string
  emailLabel?: string
  passwordLabel?: string
  confirmPasswordLabel?: string
  submitLabel?: string
  signInLabel?: string
  signInHref?: string
  showNameField?: boolean
  showConfirmPassword?: boolean
  showPasswordStrength?: boolean
  termsText?: React.ReactNode
  socialProviders?: SocialProvider[]
  onSocialLogin?: (provider: SocialProvider) => void
  showSocialDivider?: boolean
  className?: string
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

  return (
    <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-200',
              strength >= level
                ? strength === 4
                  ? 'bg-emerald-500'
                  : strength >= 3
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                : 'bg-muted'
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {checks.map((check) => (
          <div
            key={check.label}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors duration-200',
              check.valid ? 'text-emerald-600 dark:text-emerald-500' : 'text-muted-foreground'
            )}
          >
            {check.valid ? (
              <Check className="size-3 shrink-0" />
            ) : (
              <X className="size-3 shrink-0" />
            )}
            <span>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LocksmithSignUpForm({
  title = 'Create an account',
  description = 'Enter your details to get started',
  nameLabel = 'Full name',
  emailLabel = 'Email address',
  passwordLabel = 'Password',
  confirmPasswordLabel = 'Confirm password',
  submitLabel = 'Create account',
  signInLabel = 'Already have an account?',
  signInHref = '/sign-in',
  showNameField = false,
  showConfirmPassword = false,
  showPasswordStrength = true,
  termsText,
  socialProviders = [],
  onSocialLogin,
  showSocialDivider = true,
  className,
}: SignUpFormProps) {
  const { signUp, error, loading } = useLocksmithAuth()
  const poweredByLocksmith = useLocksmithPoweredBy()
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)

    const fd = new FormData(e.currentTarget)
    const email = String(fd.get('email') ?? '')
    const pwd = String(fd.get('password') ?? '')
    const confirmPwd = String(fd.get('confirmPassword') ?? '')
    const name = String(fd.get('name') ?? '')

    if (showConfirmPassword && pwd !== confirmPwd) {
      setFormError('Passwords do not match')
      return
    }

    const meta: Record<string, unknown> = {}
    if (showNameField && name) {
      meta.name = name
    }

    await signUp(email, pwd, Object.keys(meta).length > 0 ? meta : undefined)
  }

  const handleSocialLogin = async (provider: SocialProvider) => {
    setSocialLoading(provider)
    try {
      onSocialLogin?.(provider)
    } finally {
      // Keep loading until redirect happens
    }
  }

  const hasSocialProviders = socialProviders.length > 0
  const displayError = formError || error

  return (
    <Card className={cn('w-full max-w-md shadow-lg', className)}>
      <CardHeader className="space-y-1 text-center pb-2">
        <CardTitle className="text-2xl font-bold tracking-tight text-balance">
          {title}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-balance">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Social Login Buttons */}
        {hasSocialProviders && (
          <SocialButtonGroup
            providers={socialProviders}
            onProviderClick={handleSocialLogin}
            disabled={loading}
            loading={socialLoading}
            iconOnly={socialProviders.length > 3}
          />
        )}

        {/* Divider */}
        {hasSocialProviders && showSocialDivider && (
          <FieldSeparator>or continue with email</FieldSeparator>
        )}

        {/* Email/Password Form */}
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          {displayError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1">
              <p className="font-medium">{displayError}</p>
            </div>
          )}

          <FieldGroup>
            {showNameField && (
              <Field>
                <FieldLabel htmlFor="name" className="text-sm font-medium">
                  {nameLabel}
                </FieldLabel>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="John Doe"
                    className="pl-10 h-11"
                  />
                </div>
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="email" className="text-sm font-medium">
                {emailLabel}
              </FieldLabel>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  className="pl-10 h-11"
                />
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="password" className="text-sm font-medium">
                {passwordLabel}
              </FieldLabel>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {showPasswordStrength && <PasswordStrength password={password} />}
            </Field>

            {showConfirmPassword && (
              <Field>
                <FieldLabel htmlFor="confirmPassword" className="text-sm font-medium">
                  {confirmPasswordLabel}
                </FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={cn(
                      'pl-10 h-11',
                      confirmPassword &&
                        password !== confirmPassword &&
                        'border-destructive focus-visible:ring-destructive/20'
                    )}
                  />
                </div>
              </Field>
            )}
          </FieldGroup>

          {termsText && (
            <p className="text-xs text-muted-foreground text-center text-balance">
              {termsText}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 font-semibold text-base gap-2 transition-all duration-200 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                {submitLabel}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col gap-4 pt-0">
        <p className="text-center text-sm text-muted-foreground">
          {signInLabel}{' '}
          <a
            href={signInHref}
            className="font-semibold text-primary hover:text-primary/80 hover:underline underline-offset-4 transition-colors"
          >
            Sign in
          </a>
        </p>

        {poweredByLocksmith && <LocksmithPoweredBy />}
      </CardFooter>
    </Card>
  )
}
