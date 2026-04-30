'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconArrowLeft,
  IconArrowRight,
  IconShield,
  IconSpinner,
} from './form-icons.js'
import type { LocksmithFormClassNames, LocksmithFormThemeId } from './form-theme.js'
import {
  cardDescriptionStyle,
  cardHeaderStyle,
  cardTitleStyle,
  errorStyle,
  footnoteStyle,
  formBlockStackStyle,
  ghostButtonStyle,
  otpSeparatorStyle,
  otpSlotStyle,
  otpSlotsRowStyle,
  primaryButtonStyle,
  sectionStackStyle,
  totpShieldCircleStyle,
} from './form-theme.js'
import { LocksmithFormShell } from './form-shell.js'
import { useLocksmithAuth, useLocksmithPoweredBy } from './provider.js'

export type TotpFormProps = {
  theme?: LocksmithFormThemeId
  classNames?: LocksmithFormClassNames
  title?: string
  description?: string
  label?: string
  submitLabel?: string
  backLabel?: string
  onBack?: () => void
  codeLength?: 6 | 8
  autoSubmit?: boolean
  onSuccess?: () => void
  onError?: (message: string) => void
}

/** Shown when `pendingTotpToken` is non-null after password sign-in. */
export function LocksmithTotpForm({
  theme        = 'locksmith',
  classNames,
  title,
  description,
  label        = 'Verification code',
  submitLabel  = 'Verify',
  backLabel    = 'Back to sign in',
  onBack,
  codeLength   = 6,
  autoSubmit   = true,
  onSuccess,
  onError,
}: TotpFormProps) {
  const { completeTotp, pendingTotpToken, error, loading } = useLocksmithAuth()
  const poweredByLocksmith                                 = useLocksmithPoweredBy()
  const [code, setCode]                                    = useState('')
  const inputsRef                                         = useRef<Array<HTMLInputElement | null>>([])
  /** Prevents auto-submit from looping when verification fails for a full-length code. */
  const autoSubmittedCodeRef                             = useRef<string | null>(null)

  const resolvedTitle = title ?? 'Two-factor authentication'
  const resolvedDescription =
    description ??
    `Enter the ${codeLength}-digit code from your authenticator app`

  const submitTotp = useCallback(
    async (c: string) => {
      try {
        await completeTotp(c)
        onSuccess?.()
      } catch (err) {
        onError?.(err instanceof Error ? err.message : 'Verification failed')
      }
    },
    [completeTotp, onSuccess, onError],
  )

  useEffect(() => {
    if (!pendingTotpToken) {
      autoSubmittedCodeRef.current = null
    }
  }, [pendingTotpToken])

  useEffect(() => {
    if (!autoSubmit || !pendingTotpToken) return
    if (code.length !== codeLength || loading) return
    if (autoSubmittedCodeRef.current === code) return
    autoSubmittedCodeRef.current = code
    void submitTotp(code)
  }, [autoSubmit, code, codeLength, loading, pendingTotpToken, submitTotp])

  if (!pendingTotpToken) return null

  const firstGroup = Math.floor(codeLength / 2)
  const secondGroup = Math.ceil(codeLength / 2)

  function updateAt(index: number, digit: string) {
    const d = digit.replace(/\D/g, '').slice(-1)
    const arr = Array.from({ length: codeLength }, (_, i) => code[i] ?? '')
    arr[index] = d
    setCode(arr.join(''))
    if (d && index < codeLength - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Backspace') return
    if (code[index]) return
    if (index > 0) {
      e.preventDefault()
      inputsRef.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const raw = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, codeLength)
    setCode(raw)
    autoSubmittedCodeRef.current = null
    const focusIdx = Math.min(Math.max(raw.length - 1, 0), codeLength - 1)
    queueMicrotask(() => {
      inputsRef.current[focusIdx]?.focus()
    })
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (code.length !== codeLength) return
    await submitTotp(code)
  }

  return (
    <LocksmithFormShell
      theme={theme}
      classNames={classNames}
      poweredByLocksmith={poweredByLocksmith}
    >
      <div style={sectionStackStyle()}>
        <header style={{ ...cardHeaderStyle(), gap: 12 }}>
          <div style={totpShieldCircleStyle()}>
            <IconShield />
          </div>
          <div style={{ ...cardHeaderStyle(), textAlign: 'center' }}>
            <h2 style={cardTitleStyle()}>{resolvedTitle}</h2>
            <p style={cardDescriptionStyle()}>{resolvedDescription}</p>
          </div>
        </header>

        <form onSubmit={(e) => void onSubmit(e)} style={formBlockStackStyle()}>
          {error ? (
            <p role="alert" className={classNames?.error} style={errorStyle()}>
              {error}
            </p>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label
              htmlFor="locksmith-totp-0"
              style={{
                display:    'block',
                textAlign:  'center',
                fontSize:   14,
                fontWeight: 600,
                color:      'var(--ls-text)',
                fontFamily: 'var(--ls-font-display)',
              }}
            >
              {label}
            </label>
            <div style={otpSlotsRowStyle()} onPaste={handlePaste}>
              {Array.from({ length: firstGroup }, (_, i) => (
                <input
                  key={i}
                  id={i === 0 ? 'locksmith-totp-0' : undefined}
                  ref={(el) => {
                    inputsRef.current[i] = el
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  aria-label={`Digit ${i + 1}`}
                  disabled={loading}
                  value={code[i] ?? ''}
                  style={otpSlotStyle()}
                  onChange={(ev) => {
                    autoSubmittedCodeRef.current = null
                    updateAt(i, ev.target.value)
                  }}
                  onKeyDown={(ev) => {
                    handleKeyDown(i, ev)
                  }}
                  onFocus={(ev) => {
                    ev.target.select()
                  }}
                />
              ))}
              <span style={otpSeparatorStyle()}>–</span>
              {Array.from({ length: secondGroup }, (_, j) => {
                const i = j + firstGroup
                return (
                  <input
                    key={i}
                    ref={(el) => {
                      inputsRef.current[i] = el
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    aria-label={`Digit ${i + 1}`}
                    disabled={loading}
                    value={code[i] ?? ''}
                    style={otpSlotStyle()}
                    onChange={(ev) => {
                      autoSubmittedCodeRef.current = null
                      updateAt(i, ev.target.value)
                    }}
                    onKeyDown={(ev) => {
                      handleKeyDown(i, ev)
                    }}
                    onFocus={(ev) => {
                      ev.target.select()
                    }}
                  />
                )
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== codeLength}
            className={classNames?.button}
            style={primaryButtonStyle(loading || code.length !== codeLength)}
          >
            {loading ? (
              <>
                <IconSpinner size={18} />
                Verifying…
              </>
            ) : (
              <>
                {submitLabel}
                <IconArrowRight />
              </>
            )}
          </button>
        </form>

        {onBack ? (
          <button
            type="button"
            style={ghostButtonStyle(loading)}
            onClick={() => {
              onBack()
            }}
          >
            <IconArrowLeft />
            {backLabel}
          </button>
        ) : null}

        <p style={footnoteStyle()}>
          Open your authenticator app and enter the code displayed for this account.
        </p>
      </div>
    </LocksmithFormShell>
  )
}
