'use client'

import { useState, useRef, useEffect } from 'react'
import { Shield, Loader2, ArrowRight, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { useLocksmithAuth, useLocksmithPoweredBy } from '@/lib/locksmith/provider'
import { LocksmithPoweredBy } from './powered-by'

export type TotpFormProps = {
  title?: string
  description?: string
  label?: string
  submitLabel?: string
  backLabel?: string
  onBack?: () => void
  codeLength?: 6 | 8
  autoSubmit?: boolean
  className?: string
}

export function LocksmithTotpForm({
  title = 'Two-factor authentication',
  description = 'Enter the 6-digit code from your authenticator app',
  label = 'Verification code',
  submitLabel = 'Verify',
  backLabel = 'Back to sign in',
  onBack,
  codeLength = 6,
  autoSubmit = true,
  className,
}: TotpFormProps) {
  const { completeTotp, pendingTotpToken, error, loading } = useLocksmithAuth()
  const poweredByLocksmith = useLocksmithPoweredBy()
  const [code, setCode] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  // Auto-submit when code is complete
  useEffect(() => {
    if (autoSubmit && code.length === codeLength && !loading) {
      void completeTotp(code)
    }
  }, [code, codeLength, autoSubmit, loading, completeTotp])

  if (!pendingTotpToken) return null

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (code.length !== codeLength) return
    await completeTotp(code)
  }

  return (
    <Card className={cn('w-full max-w-md shadow-lg', className)}>
      <CardHeader className="space-y-3 text-center pb-2">
        <div className="mx-auto size-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="size-7 text-primary" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-balance">
            {title}
          </CardTitle>
          <CardDescription className="text-muted-foreground text-balance">
            {description}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <form
          ref={formRef}
          onSubmit={(e) => void onSubmit(e)}
          className="space-y-6"
        >
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center animate-in fade-in-0 slide-in-from-top-1">
              <p className="font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-sm font-medium text-center block">
              {label}
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
                  {Array.from({ length: Math.floor(codeLength / 2) }).map(
                    (_, i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="size-12 text-lg font-semibold border-2 rounded-lg"
                      />
                    )
                  )}
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  {Array.from({ length: Math.ceil(codeLength / 2) }).map(
                    (_, i) => (
                      <InputOTPSlot
                        key={i + Math.floor(codeLength / 2)}
                        index={i + Math.floor(codeLength / 2)}
                        className="size-12 text-lg font-semibold border-2 rounded-lg"
                      />
                    )
                  )}
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
                {submitLabel}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>

        {onBack && (
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="w-full gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {backLabel}
          </Button>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-4 pt-0">
        <p className="text-center text-xs text-muted-foreground text-balance">
          Open your authenticator app and enter the code displayed for this
          account.
        </p>
        {poweredByLocksmith && <LocksmithPoweredBy />}
      </CardFooter>
    </Card>
  )
}
