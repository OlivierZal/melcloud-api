/**
 * Minimal structural shape required by the Classic API call loggers.
 *
 * Both `HttpRequestConfig` (used internally by `HttpClient.request`)
 * and Home's literal request config (built inside `#dispatch`) satisfy
 * this contract structurally — no double type assertion is needed at
 * the call site, and the transport stays free to evolve.
 */
export interface LoggableRequestConfig {
  readonly data?: unknown
  readonly headers?: unknown
  readonly method?: string | undefined
  readonly params?: unknown
  readonly url?: string | undefined
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

/**
 * Placeholder written over any value whose key names a secret.
 */
export const REDACTED = '******'

// Every key that names a credential on either wire, plus the OAuth
// vocabulary the Home flow speaks. `owneremail` earns its place from
// the Classic list payload, which carries the account's address on
// EVERY device of EVERY successful sync — the one entry here that
// blanks a routine 200 rather than a failure.
const sensitiveKeys = new Set([
  'access_token',
  'authorization',
  'client_secret',
  'code',
  'code_verifier',
  'contextkey',
  'cookie',
  'email',
  'id_token',
  'owneremail',
  'password',
  'refresh_token',
  'set-cookie',
  'token',
  'username',
  'x-mitscontextkey',
])

/**
 * Whether a header or payload key names a secret — the one vocabulary
 * shared by the call loggers and the {@link HttpError} request
 * snapshot, so a secret cannot reach a log through either route.
 * @param key - Header or payload key, in any casing.
 * @returns `true` when the value behind the key must be redacted.
 */
export const isSensitive = (key: string): boolean =>
  sensitiveKeys.has(key.toLowerCase())

// Detect a string that looks like an `application/x-www-form-urlencoded`
// body and contains at least one sensitive key (e.g. `password=...`).
// Returns the redacted form, or `undefined` when nothing was redacted so
// the caller can keep the original value untouched.
//
// Required because Home's `#submitCredentials()` posts credentials as a
// URLSearchParams string, and the object-key redaction below otherwise
// passes the entire body through verbatim.
const redactFormEncoded = (value: string): string | undefined => {
  if (!value.includes('=')) {
    return undefined
  }
  const params = new URLSearchParams(value)
  // Snapshot the keys before mutating: URLSearchParams iterators are
  // live and `set()` collapses duplicate entries, so redacting a
  // multi-valued key mid-iteration could otherwise skip the entry
  // that shifts into the vacated slot. A multi-valued key appears
  // several times in the snapshot; the extra `set()` calls are no-ops.
  const keysToRedact = params
    .keys()
    .filter((key) => isSensitive(key))
    .toArray()
  for (const key of keysToRedact) {
    params.set(key, REDACTED)
  }
  return keysToRedact.length > 0 ? params.toString() : undefined
}

/**
 * Redacts every value whose key names a secret, walking nested objects,
 * arrays and form-encoded strings — the deep counterpart of
 * {@link isSensitive}, shared with the {@link HttpError} snapshot so a
 * request body cannot leak a credential the loggers would have hidden.
 * @param value - Any payload: object, array, string or primitive.
 * @returns The value with sensitive entries replaced by {@link REDACTED}.
 */
export const redactValue = (value: unknown): unknown => {
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
      isSensitive(key) ? REDACTED : redactValue(property),
    ]),
  )
}

/**
 * Abstract base for API call logging data, serializable to JSON with a fixed set of log keys.
 */
export abstract class APICallLogData {
  declare public readonly dataType: string

  public readonly method?: string | undefined

  public readonly params: unknown

  public readonly url?: string | undefined

  protected constructor(config?: LoggableRequestConfig) {
    this.method = config?.method?.toUpperCase()
    this.url = config?.url
    this.params = config?.params
  }

  public toString(): string {
    const filtered = Object.fromEntries(
      logKeys
        .filter((key) => Object.hasOwn(this, key))
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
