import type { LocksmithEnvironment } from './types.js'

export function environmentFromApiKey(apiKey: string): LocksmithEnvironment {
  if (apiKey.startsWith('lsm_live_')) return 'production'
  if (apiKey.startsWith('lsm_sbx_')) return 'sandbox'
  throw new Error('Invalid Locksmith API key: expected prefix lsm_live_ or lsm_sbx_.')
}
