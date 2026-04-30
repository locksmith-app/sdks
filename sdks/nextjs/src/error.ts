/** Thrown when Locksmith returns a non-OK response or the BFF returns an error. */
export class LocksmithAuthError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'LocksmithAuthError'
    this.code = code
    this.status = status
  }
}
