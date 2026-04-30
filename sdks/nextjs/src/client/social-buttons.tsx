'use client'

import {
  outlineButtonStyle,
  outlineIconButtonStyle,
  socialGridStyle,
  socialIconWrapStyle,
} from './form-theme.js'
import {
  AppleIcon,
  DiscordIcon,
  GitHubIcon,
  GoogleIcon,
  LinkedInIcon,
  MicrosoftIcon,
  XIcon,
} from './social-icons.js'
import { IconSpinner } from './form-icons.js'

export type SocialProvider =
  | 'google'
  | 'github'
  | 'apple'
  | 'microsoft'
  | 'x'
  | 'discord'
  | 'linkedin'

const providerConfig: Record<
  SocialProvider,
  { label: string; icon: typeof GoogleIcon }
> = {
  google:    { label: 'Google', icon: GoogleIcon },
  github:    { label: 'GitHub', icon: GitHubIcon },
  apple:     { label: 'Apple', icon: AppleIcon },
  microsoft: { label: 'Microsoft', icon: MicrosoftIcon },
  x:         { label: 'X', icon: XIcon },
  discord:   { label: 'Discord', icon: DiscordIcon },
  linkedin:  { label: 'LinkedIn', icon: LinkedInIcon },
}

export type SocialButtonProps = {
  provider: SocialProvider
  onClick?:   () => void
  disabled?:  boolean
  loading?:   boolean
  iconOnly?:  boolean
}

export function LocksmithSocialButton({
  provider,
  onClick,
  disabled,
  loading,
  iconOnly = false,
}: SocialButtonProps) {
  const config = providerConfig[provider]
  const Icon   = config.icon
  const dimmed = Boolean(disabled || loading)
  const base   = iconOnly ? outlineIconButtonStyle(dimmed) : outlineButtonStyle(dimmed)

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={dimmed}
      style={base}
      aria-label={iconOnly ? `Continue with ${config.label}` : undefined}
    >
      {loading ? <IconSpinner size={20} /> : <Icon />}
      {!iconOnly ? (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Continue with {config.label}
        </span>
      ) : null}
    </button>
  )
}

export type SocialButtonGroupProps = {
  providers:        SocialProvider[]
  onProviderClick?: (provider: SocialProvider) => void
  disabled?:         boolean
  loading?:          SocialProvider | null
  iconOnly?: boolean
  columns?:  1 | 2 | 3 | 4
}

export function LocksmithSocialButtonGroup({
  providers,
  onProviderClick,
  disabled,
  loading,
  iconOnly = false,
  columns  = 1,
}: SocialButtonGroupProps) {
  const shouldUseGrid = iconOnly || columns > 1 || providers.length > 2

  if (shouldUseGrid && iconOnly) {
    return (
      <div style={socialIconWrapStyle()}>
        {providers.map((p) => (
          <LocksmithSocialButton
            key={p}
            provider={p}
            onClick={() => {
              onProviderClick?.(p)
            }}
            disabled={disabled}
            loading={loading === p}
            iconOnly
          />
        ))}
      </div>
    )
  }

  if (shouldUseGrid) {
    return (
      <div style={socialGridStyle(columns)}>
        {providers.map((p) => (
          <LocksmithSocialButton
            key={p}
            provider={p}
            onClick={() => {
              onProviderClick?.(p)
            }}
            disabled={disabled}
            loading={loading === p}
          />
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {providers.map((p) => (
        <LocksmithSocialButton
          key={p}
          provider={p}
          onClick={() => {
            onProviderClick?.(p)
          }}
          disabled={disabled}
          loading={loading === p}
        />
      ))}
    </div>
  )
}
