'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  GoogleIcon,
  GitHubIcon,
  AppleIcon,
  MicrosoftIcon,
  XIcon,
  DiscordIcon,
  LinkedInIcon,
} from './social-icons'

export type SocialProvider =
  | 'google'
  | 'github'
  | 'apple'
  | 'microsoft'
  | 'x'
  | 'discord'
  | 'linkedin'

export type SocialButtonProps = {
  provider: SocialProvider
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  className?: string
  iconOnly?: boolean
}

const providerConfig: Record<
  SocialProvider,
  {
    label: string
    icon: React.ComponentType<{ className?: string }>
    bgClass?: string
    textClass?: string
  }
> = {
  google: {
    label: 'Google',
    icon: GoogleIcon,
  },
  github: {
    label: 'GitHub',
    icon: GitHubIcon,
  },
  apple: {
    label: 'Apple',
    icon: AppleIcon,
  },
  microsoft: {
    label: 'Microsoft',
    icon: MicrosoftIcon,
  },
  x: {
    label: 'X',
    icon: XIcon,
  },
  discord: {
    label: 'Discord',
    icon: DiscordIcon,
  },
  linkedin: {
    label: 'LinkedIn',
    icon: LinkedInIcon,
  },
}

export function SocialButton({
  provider,
  onClick,
  disabled,
  loading,
  className,
  iconOnly = false,
}: SocialButtonProps) {
  const config = providerConfig[provider]
  const Icon = config.icon

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'relative h-11 w-full gap-3 font-medium transition-all duration-200',
        'hover:bg-accent/50 hover:border-accent-foreground/20',
        'active:scale-[0.98]',
        iconOnly && 'w-11 px-0',
        className
      )}
    >
      {loading ? (
        <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Icon className="size-5 shrink-0" />
      )}
      {!iconOnly && (
        <span className="truncate">Continue with {config.label}</span>
      )}
    </Button>
  )
}

export type SocialButtonGroupProps = {
  providers: SocialProvider[]
  onProviderClick?: (provider: SocialProvider) => void
  disabled?: boolean
  loading?: SocialProvider | null
  className?: string
  iconOnly?: boolean
  columns?: 1 | 2 | 3 | 4
}

export function SocialButtonGroup({
  providers,
  onProviderClick,
  disabled,
  loading,
  className,
  iconOnly = false,
  columns = 1,
}: SocialButtonGroupProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }

  // If more than 2 providers with icon-only mode, or columns > 1, use grid
  const shouldUseGrid = iconOnly || columns > 1 || providers.length > 2

  if (shouldUseGrid && iconOnly) {
    return (
      <div className={cn('flex flex-wrap justify-center gap-3', className)}>
        {providers.map((provider) => (
          <SocialButton
            key={provider}
            provider={provider}
            onClick={() => onProviderClick?.(provider)}
            disabled={disabled}
            loading={loading === provider}
            iconOnly
          />
        ))}
      </div>
    )
  }

  if (shouldUseGrid) {
    return (
      <div className={cn('grid gap-3', gridCols[columns], className)}>
        {providers.map((provider) => (
          <SocialButton
            key={provider}
            provider={provider}
            onClick={() => onProviderClick?.(provider)}
            disabled={disabled}
            loading={loading === provider}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {providers.map((provider) => (
        <SocialButton
          key={provider}
          provider={provider}
          onClick={() => onProviderClick?.(provider)}
          disabled={disabled}
          loading={loading === provider}
        />
      ))}
    </div>
  )
}
