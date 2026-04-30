'use client'

import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { useState } from 'react'
import { Fingerprint, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { LocksmithAuthError } from '@/lib/locksmith/error'
import { LocksmithBffClient, type LocksmithBffClientOptions } from '@/lib/locksmith/bff-client'

export type PasskeySignInButtonProps = {
  bff: LocksmithBffClientOptions
  email: string
  children?: React.ReactNode
  onSuccess?: () => void
  onError?: (error: string) => void
  className?: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
}

export function LocksmithPasskeySignInButton({
  bff,
  email,
  children = 'Sign in with passkey',
  onSuccess,
  onError,
  className,
  variant = 'outline',
}: PasskeySignInButtonProps) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function onClick() {
    setMessage(null)
    setBusy(true)
    try {
      const client = new LocksmithBffClient(bff)
      const { startAuthentication } = await import('@simplewebauthn/browser')
      const { challengeId, options } = await client.passkeyLoginOptions(email)
      const response = await startAuthentication({
        optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON,
      })
      await client.passkeyLoginVerify({
        challengeId,
        email,
        response: response as unknown as Record<string, unknown>,
      })
      onSuccess?.()
      window.location.reload()
    } catch (e) {
      const errorMessage =
        e instanceof LocksmithAuthError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Passkey sign-in failed'
      setMessage(errorMessage)
      onError?.(errorMessage)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {message && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center animate-in fade-in-0 slide-in-from-top-1">
          <p className="font-medium">{message}</p>
        </div>
      )}
      <Button
        type="button"
        variant={variant}
        disabled={busy || !email}
        onClick={() => void onClick()}
        className={cn(
          'w-full h-11 gap-3 font-medium transition-all duration-200 active:scale-[0.98]',
          className
        )}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Fingerprint className="size-5" />
        )}
        {children}
      </Button>
    </div>
  )
}
