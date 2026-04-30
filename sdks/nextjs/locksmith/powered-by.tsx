import { cn } from '@/lib/utils'

const LINK = 'https://getlocksmith.dev?utm_source=powered_by&utm_medium=nextjs_sdk'

export type LocksmithPoweredByProps = {
  className?: string
}

export function LocksmithPoweredBy({ className }: LocksmithPoweredByProps) {
  return (
    <p
      className={cn(
        'mt-6 pt-4 border-t text-center text-xs text-muted-foreground',
        className
      )}
    >
      Powered by{' '}
      <a
        href={LINK}
        target="_blank"
        rel="noreferrer noopener"
        className="font-semibold text-primary hover:underline underline-offset-4 transition-colors"
      >
        Locksmith
      </a>
    </p>
  )
}
