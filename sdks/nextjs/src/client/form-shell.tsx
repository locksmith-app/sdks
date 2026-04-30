'use client'

import type { CSSProperties, ReactNode } from 'react'
import {
  LOCKSMITH_FORM_KEYFRAMES_CSS,
  type LocksmithFormClassNames,
  type LocksmithFormThemeId,
  locksmithFormThemeStyle,
  mergeFormClasses,
} from './form-theme.js'
import { LocksmithPoweredBy } from './powered-by.js'

export type LocksmithFormSurfaceProps = {
  theme?: LocksmithFormThemeId
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/** Card shell + spinner keyframes — use for standalone blocks (passkey, OAuth, OIDC errors). */
export function LocksmithFormSurface({
  theme = 'locksmith',
  className,
  style,
  children,
}: LocksmithFormSurfaceProps) {
  return (
    <>
      <style>{LOCKSMITH_FORM_KEYFRAMES_CSS}</style>
      <div
        className={className}
        style={{ ...locksmithFormThemeStyle(theme), ...style }}
        data-locksmith-theme={theme}
      >
        {children}
      </div>
    </>
  )
}

export type LocksmithFormShellProps = {
  theme?: LocksmithFormThemeId
  classNames?: LocksmithFormClassNames
  children: ReactNode
  /** From `useLocksmithPoweredBy()` or provider session — when true, footer is always rendered. */
  poweredByLocksmith: boolean
}

export function LocksmithFormShell({
  theme = 'locksmith',
  classNames,
  children,
  poweredByLocksmith,
}: LocksmithFormShellProps) {
  return (
    <LocksmithFormSurface
      theme={theme}
      className={mergeFormClasses('locksmith-form-root', classNames?.root)}
    >
      {children}
      {poweredByLocksmith ? (
        <LocksmithPoweredBy className={classNames?.poweredBy} />
      ) : null}
    </LocksmithFormSurface>
  )
}
