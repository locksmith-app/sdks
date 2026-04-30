// Forms
export { LocksmithSignInForm, type SignInFormProps } from './sign-in-form'
export { LocksmithSignUpForm, type SignUpFormProps } from './sign-up-form'
export { LocksmithTotpForm, type TotpFormProps } from './totp-form'
export { LocksmithPasskeySignInButton, type PasskeySignInButtonProps } from './passkey-button'

// Social Login
export { SocialButton, SocialButtonGroup, type SocialProvider, type SocialButtonProps, type SocialButtonGroupProps } from './social-buttons'
export {
  GoogleIcon,
  GitHubIcon,
  AppleIcon,
  MicrosoftIcon,
  XIcon,
  DiscordIcon,
  LinkedInIcon,
  PasskeyIcon,
  KeyIcon,
} from './social-icons'

// Utilities
export { LocksmithPoweredBy, type LocksmithPoweredByProps } from './powered-by'

// Re-export provider and client from lib
export {
  LocksmithAuthProvider,
  useLocksmithAuth,
  useLocksmithPoweredBy,
  type LocksmithAuthContextValue,
  type LocksmithAuthProviderProps,
} from '@/lib/locksmith/provider'
export { LocksmithBffClient, type LocksmithBffClientOptions, type BffSignInSuccess } from '@/lib/locksmith/bff-client'
export { LocksmithAuthError } from '@/lib/locksmith/error'
export type { UserMe, SignInUser, SignInRequiresTotp, SignUpResult } from '@/lib/locksmith/types'
