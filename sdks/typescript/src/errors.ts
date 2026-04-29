/** Thrown when the API returns a non-OK response. */
export class LocksmithError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'LocksmithError'
    this.code = code
    this.status = status
  }
}
