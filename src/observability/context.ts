/**
 * Minimal structural shape required by the Classic API call loggers.
 *
 * Both `InternalAxiosRequestConfig` (Classic, via the axios interceptors)
 * and Home's literal request config (built inside `#dispatch`) satisfy
 * this contract structurally — no double type assertion is needed at the
 * call site, and changes to axios's internal config type can't break us.
 */
export interface LoggableRequestConfig {
  readonly data?: unknown
  readonly headers?: unknown
  readonly method?: string
  readonly params?: unknown
  readonly url?: string
}

// Fixed key order for consistent, readable JSON log output
const logKeys = [
  'dataType',
  'method',
  'url',
  'params',
  'headers',
  'requestData',
  'responseData',
  'status',
  'errorMessage',
]

const REDACTED = '******'

const sensitiveKeys = new Set([
  'authorization',
  'contextkey',
  'cookie',
  'email',
  'password',
  'set-cookie',
  'username',
  'x-mitscontextkey',
])

const isSensitive = (key: string): boolean =>
  sensitiveKeys.has(key.toLowerCase())

/*
 * Detect a string that looks like an `application/x-www-form-urlencoded`
 * body and contains at least one sensitive key (e.g. `password=...`).
 * Returns the redacted form, or `undefined` when nothing was redacted so
 * the caller can keep the original value untouched.
 *
 * Required because Home's `#submitCredentials()` posts credentials as a
 * URLSearchParams string, and the object-key redaction below otherwise
 * passes the entire body through verbatim.
 */
const redactFormEncoded = (value: string): string | undefined => {
  if (!value.includes('=')) {
    return undefined
  }
  const params = new URLSearchParams(value)
  let hasRedacted = false
  for (const key of params.keys()) {
    if (isSensitive(key)) {
      params.set(key, REDACTED)
      hasRedacted = true
    }
  }
  return hasRedacted ? params.toString() : undefined
}

const redactValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return redactFormEncoded(value) ?? value
  }
  if (typeof value !== 'object' || value === null) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => redactValue(item))
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, property]) => [
      key,
      isSensitive(key) ? REDACTED : property,
    ]),
  )
}

/** Abstract base for API call logging data, serializable to JSON with a fixed set of log keys. */
export abstract class APICallLogData {
  declare public readonly dataType: string

  public readonly method: string | undefined

  public readonly params: unknown

  public readonly url: string | undefined

  protected constructor(config?: LoggableRequestConfig) {
    this.method = config?.method?.toUpperCase()
    this.url = config?.url
    this.params = config?.params
  }

  public toString(): string {
    const filtered = Object.fromEntries(
      logKeys
        .filter((key) => key in this)
        .map((key) => [
          key,
          redactValue(
            Object.getOwnPropertyDescriptor(this, key)?.value as unknown,
          ),
        ]),
    )
    return JSON.stringify(filtered, null, 2)
  }
}
