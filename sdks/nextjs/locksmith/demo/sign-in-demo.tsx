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
import { Field, FieldLabel, FieldGroup, FieldSeparator } from '@/components/ui/field'
import { SocialButtonGroup, type SocialProvider } from '../social-buttons'

export function LocksmithSignInFormDemo() {
  const [showPassword, setShowPassword] = useState(false)
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
    setError('This is a demo - authentication is not connected')
    setLoading(false)
  }

  const handleSocialLogin = async (provider: SocialProvider) => {
    setSocialLoading(provider)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setError(`${provider} login is not connected in this demo`)
    setSocialLoading(null)
  }

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="space-y-1 text-center pb-2">
        <CardTitle className="text-2xl font-bold tracking-tight text-balance">
          Welcome back
        </CardTitle>
        <CardDescription className="text-muted-foreground text-balance">
          Enter your credentials to access your account
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
              <FieldLabel htmlFor="demo-signin-email" className="text-sm font-medium">
                Email address
              </FieldLabel>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="demo-signin-email"
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
                <FieldLabel htmlFor="demo-signin-password" className="text-sm font-medium">
                  Password
                </FieldLabel>
                <a
                  href="#"
                  className="text-xs font-medium text-primary hover:text-primary/80 hover:underline underline-offset-4 transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="demo-signin-password"
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
                Sign in
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col gap-4 pt-0">
        <p className="text-center text-sm text-muted-foreground">
          {"Don't have an account?"}{' '}
          <a
            href="#"
            className="font-semibold text-primary hover:text-primary/80 hover:underline underline-offset-4 transition-colors"
          >
            Create account
          </a>
        </p>
      </CardFooter>
    </Card>
  )
}
