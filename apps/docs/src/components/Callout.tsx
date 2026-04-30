import React from 'react'
import clsx from 'clsx'
import styles from './Callout.module.css'

type Variant = 'note' | 'tip' | 'warning' | 'danger'

export function Callout({
  children,
  title,
  variant = 'note',
}: {
  children: React.ReactNode
  title?: string
  variant?: Variant
}) {
  return (
    <div className={clsx(styles.callout, styles[variant])}>
      {title ? <strong className={styles.title}>{title}</strong> : null}
      <div className={styles.body}>{children}</div>
    </div>
  )
}
