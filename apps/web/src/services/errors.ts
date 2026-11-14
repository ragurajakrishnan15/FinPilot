export class ApiError extends Error {
  code: string
  details?: Record<string, string>
  constructor(code: string, message: string, details?: Record<string, string>) {
    super(message)
    this.code = code
    this.details = details
  }
}
