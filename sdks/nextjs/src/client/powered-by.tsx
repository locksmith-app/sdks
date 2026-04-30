import type { CSSProperties } from 'react'
import { mergeFormClasses } from './form-theme.js'

const LINK = 'https://getlocksmith.dev?utm_source=powered_by&utm_medium=nextjs_sdk'

export type LocksmithPoweredByProps = {
  className?: string
  style?: CSSProperties
}

/**
 * Required on Free-plan projects (`poweredByLocksmith` from session). There is no prop to hide it;
 * omit wrapping your own copy if you must not show attribution (upgrade the Locksmith plan instead).
 */
export function LocksmithPoweredBy({ className, style }: LocksmithPoweredByProps) {
  return (
    <p
      className={mergeFormClasses('locksmith-powered-by', className)}
      style={{
        margin:        '14px 0 0',
        paddingTop:    12,
        borderTop:     '1px solid var(--ls-border)',
        fontSize:      12,
        lineHeight:    1.45,
        color:         'var(--ls-faint)',
        textAlign:     'center',
        fontFamily:    'var(--ls-font)',
        ...style,
      }}
    >
      Powered by{' '}
      <a
        href={LINK}
        target="_blank"
        rel="noreferrer noopener"
        style={{
          color:           'var(--ls-accent)',
          textDecoration:  'none',
          fontWeight:      600,
        }}
      >
        Locksmith
      </a>
    </p>
  )
}
