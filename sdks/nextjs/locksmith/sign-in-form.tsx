'use client'

import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowRight } from 'lucide-react'
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
import { Field, FieldLabel, FieldGroup, FieldError, FieldSeparator } from '@/components/ui/field'
import { useLocksmithAuth, useLocksmithPoweredBy } from '@/lib/locksmith/provider'
import { LocksmithPoweredBy } from './powered-by'
import { SocialButtonGroup, type SocialProvider } from './social-buttons'

export type SignInFormProps = {
  title?: string
  description?: string
  emailLabel?: string
  passwordLabel?: string
  submitLabel?: string
  forgotPasswordLabel?: string
  forgotPasswordHref?: string
  signUpLabel?: string
  signUpHref?: string
  socialProviders?: SocialProvider[]
  onSocialLogin?: (provider: SocialProvider) => void
  showSocialDivider?: boolean
  className?: string
}

export function LocksmithSignInForm({
  title = 'Welcome back',
  description = 'Enter your credentials to access your account',
  emailLabel = 'Email address',
  passwordLabel = 'Password',
  submitLabel = 'Sign in',
  forgotPasswordLabel = 'Forgot password?',
  forgotPasswordHref = '/forgot-password',
  signUpLabel = "Don't have an account?",
  signUpHref = '/sign-up',
  socialProviders = [],
  onSocialLogin,
  showSocialDivider = true,
  className,
}: SignInFormProps) {
  const { signInWithPassword, error, loading } = useLocksmithAuth()
  const poweredByLocksmith = useLocksmithPoweredBy()
  const [showPassword, setShowPassword] = useState(false)
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    await signInWithPassword(
      String(fd.get('email') ?? ''),
      String(fd.get('password') ?? '')
    )
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
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1">
              <p className="font-medium">{error}</p>
            </div>
          )}

          <FieldGroup>
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
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="password" className="text-sm font-medium">
                  {passwordLabel}
                </FieldLabel>
                <a
                  href={forgotPasswordHref}
                  className="text-xs font-medium text-primary hover:text-primary/80 hover:underline underline-offset-4 transition-colors"
                >
                  {forgotPasswordLabel}
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
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
            </Field>
          </FieldGroup>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 font-semibold text-base gap-2 transition-all duration-200 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing in...
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
          {signUpLabel}{' '}
          <a
            href={signUpHref}
            className="font-semibold text-primary hover:text-primary/80 hover:underline underline-offset-4 transition-colors"
          >
            Create account
          </a>
        </p>

        {poweredByLocksmith && <LocksmithPoweredBy />}
      </CardFooter>
    </Card>
  )
}
