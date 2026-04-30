'use client'

import { useState, useEffect } from 'react'
import { Shield, Loader2, ArrowRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp'

export function LocksmithTotpFormDemo() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codeLength = 6

  // Auto-submit when code is complete
  useEffect(() => {
    if (code.length === codeLength && !loading) {
      void handleSubmit()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  async function handleSubmit() {
    setError(null)
    setLoading(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Demo: show error for demo purposes
    setError('This is a demo - TOTP verification is not connected')
    setLoading(false)
    setCode('')
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (code.length !== codeLength) return
    await handleSubmit()
  }

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="space-y-3 text-center pb-2">
        <div className="mx-auto size-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="size-7 text-primary" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-balance">
            Two-factor authentication
          </CardTitle>
          <CardDescription className="text-muted-foreground text-balance">
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center animate-in fade-in-0 slide-in-from-top-1">
              <p className="font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-sm font-medium text-center block">
              Verification code
            </label>
            <div className="flex justify-center">
              <InputOTP
                maxLength={codeLength}
                value={code}
                onChange={(value) => setCode(value)}
                disabled={loading}
                containerClassName="gap-2"
              >
                <InputOTPGroup>
                  {[0, 1, 2].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="size-12 text-lg font-semibold border-2 rounded-lg"
                    />
                  ))}
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  {[3, 4, 5].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="size-12 text-lg font-semibold border-2 rounded-lg"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || code.length !== codeLength}
            className="w-full h-11 font-semibold text-base gap-2 transition-all duration-200 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                Verify
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>

        <Button
          type="button"
          variant="ghost"
          className="w-full gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to sign in
        </Button>
      </CardContent>

      <CardFooter className="flex flex-col gap-4 pt-0">
        <p className="text-center text-xs text-muted-foreground text-balance">
          Open your authenticator app and enter the code displayed for this
          account.
        </p>
      </CardFooter>
    </Card>
  )
}
