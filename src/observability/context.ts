// Thin vocabulary module over @olivierzal/api-core: the redaction
// MECHANISM lives in the core (shared with heatzy-api); this file owns
// only the MELCloud sensitive-key vocabulary and the bound engine every
// redaction seat in this SDK shares.
import { type Redaction, createRedaction } from '@olivierzal/api-core'

export type { LoggableRequestConfig } from '@olivierzal/api-core'

export { APICallLogData, REDACTED } from '@olivierzal/api-core'

// Every key that names a credential on either wire beyond the core's
// base vocabulary (authorization, cookie, set-cookie, password,
// username, email, token), plus the OAuth vocabulary the Home flow
// speaks. `owneremail` earns its place from the Classic list payload,
// which carries the account's address on EVERY device of EVERY
// successful sync — the one entry here that blanks a routine 200
// rather than a failure.
const EXTRA_SENSITIVE_KEYS = [
  'access_token',
  'client_secret',
  'code',
  'code_verifier',
  'contextkey',
  'id_token',
  'owneremail',
  'refresh_token',
  'x-mitscontextkey',
]

/**
 * The redaction engine bound to the MELCloud vocabulary — the ONE
 * engine shared by the call loggers, the `HttpClient` transport and
 * the `HttpError` snapshot, so a secret cannot reach a log through
 * any route.
 */
export const redaction: Redaction = createRedaction(EXTRA_SENSITIVE_KEYS)

/**
 * Whether a header or payload key names a secret under the MELCloud
 * vocabulary.
 * @param key - Header or payload key, in any casing.
 * @returns `true` when the value behind the key must be redacted.
 */
export const isSensitive = (key: string): boolean => redaction.isSensitive(key)

/**
 * Deep-redacts a payload under the MELCloud vocabulary.
 * @param value - Any payload: object, array, string or primitive.
 * @returns The value with sensitive entries replaced by {@link REDACTED}.
 */
export const redactValue = (value: unknown): unknown =>
  redaction.redactValue(value)

/**
 * Redacts the query-string portion of a URL under the MELCloud
 * vocabulary.
 * @param url - Request URL, with or without a query string.
 * @returns The URL with sensitive query values replaced by {@link REDACTED}.
 */
export const redactUrl = (url: string): string => redaction.redactUrl(url)
