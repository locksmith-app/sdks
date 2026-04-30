import type { LocksmithEnvironment } from './types.js'

export function locksmithEnvironmentFromApiKey(key: string): LocksmithEnvironment {
  if (key.startsWith('lsm_live_')) return 'production'
  if (key.startsWith('lsm_sbx_')) return 'sandbox'
  throw new Error(
    'Invalid Locksmith API key: expected prefix lsm_live_ (Production) or lsm_sbx_ (Sandbox).',
  )
}
