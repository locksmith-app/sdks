'use client'

import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowRight, Check, X } from 'lucide-react'
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
import { SocialButtonGroup, type SocialProvider } from '../social-buttons'

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

export function LocksmithSignUpFormDemo() {
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const socialProviders: SocialProvider[] = ['google', 'github', 'apple']

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Demo: show error for demo purposes
    setError('This is a demo - registration is not connected')
    setLoading(false)
  }

  const handleSocialLogin = async (provider: SocialProvider) => {
    setSocialLoading(provider)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setError(`${provider} sign up is not connected in this demo`)
    setSocialLoading(null)
  }

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="space-y-1 text-center pb-2">
        <CardTitle className="text-2xl font-bold tracking-tight text-balance">
          Create an account
        </CardTitle>
        <CardDescription className="text-muted-foreground text-balance">
          Enter your details to get started
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Social Login Buttons */}
        <SocialButtonGroup
          providers={socialProviders}
          onProviderClick={handleSocialLogin}
          disabled={loading}
          loading={socialLoading}
        />

        {/* Divider */}
        <FieldSeparator>or continue with email</FieldSeparator>

        {/* Email/Password Form */}
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1">
              <p className="font-medium">{error}</p>
            </div>
          )}

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="demo-signup-email" className="text-sm font-medium">
                Email address
              </FieldLabel>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="demo-signup-email"
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
              <FieldLabel htmlFor="demo-signup-password" className="text-sm font-medium">
                Password
              </FieldLabel>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="demo-signup-password"
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
              <PasswordStrength password={password} />
            </Field>
          </FieldGroup>

          <p className="text-xs text-muted-foreground text-center text-balance">
            By creating an account, you agree to our{' '}
            <a href="#" className="text-primary hover:underline underline-offset-4">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-primary hover:underline underline-offset-4">
              Privacy Policy
            </a>
          </p>

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
                Create account
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col gap-4 pt-0">
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <a
            href="#"
            className="font-semibold text-primary hover:text-primary/80 hover:underline underline-offset-4 transition-colors"
          >
            Sign in
          </a>
        </p>
      </CardFooter>
    </Card>
  )
}
