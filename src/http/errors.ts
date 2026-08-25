import {
  isSensitive,
  REDACTED,
  redactUrl,
  redactValue,
} from '../observability/context.ts'

// The snapshot travels inside a thrown error, so it reaches every
// logger a host happens to run — including the diagnostic reports users
// paste into issues. Redacting at construction removes the leak as a
// class: no call site can retain a credential by forgetting to
// sanitize. Every field carrying one is covered, not just the obvious
// header: the Classic sign-in puts the account's password in the
// request BODY, and a session cookie comes back in the response.
const redactHeaders = <T>(
  headers: Readonly<Record<string, T>>,
): Record<string, string | T> =>
  Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      isSensitive(key) ? REDACTED : value,
    ]),
  )

const redactParams = (
  params: Readonly<Record<string, unknown>>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      isSensitive(key) ? REDACTED : redactValue(value),
    ]),
  )

/**
 * Snapshot of the request that triggered an {@link HttpError}. Any
 * value naming a secret — header, body field or query parameter —
 * reads as `******`.
 * @category HTTP
 */
export interface HttpErrorRequestConfig {
  readonly data?: unknown
  readonly headers?: Record<string, string> | undefined
  readonly method?: string | undefined
  readonly params?: Record<string, unknown> | undefined
  readonly url?: string | undefined
}

/**
 * Thrown by {@link HttpClient} whenever an upstream response has a non-2xx
 * status. The shape mirrors what downstream code needs: `response.status`,
 * `response.headers`, and `response.data`.
 *
 * Both halves are redacted: a failed response body is a DIAGNOSTIC
 * payload, not a contract — upstreams echo the credential they just
 * rejected, and the SDK's own loggers have always blanked it. It is
 * therefore typed `unknown`, since nothing may rely on the shape of a
 * value whose secrets have been replaced.
 * @category HTTP
 */
export class HttpError extends Error {
  public readonly config?: HttpErrorRequestConfig | undefined

  public readonly isHttpError = true

  public readonly response: {
    readonly data: unknown
    readonly headers: Record<string, string | string[]>
    readonly status: number
  }

  /**
   * Builds the error from the response triplet plus an optional snapshot
   * of the request that produced it.
   * @param message - Human-readable error description.
   * @param options - Response triplet plus an optional request snapshot.
   * @param options.response - Normalized response that carried the non-2xx status.
   * @param options.response.data - Parsed (or raw text) response body.
   * @param options.response.headers - HTTP headers, multi-valued `set-cookie` preserved as an array.
   * @param options.response.status - HTTP status code.
   * @param options.config - Snapshot of the request that triggered the error.
   * @param options.cause - Original error that triggered this one.
   */
  public constructor(
    message: string,
    options: {
      response: {
        data: unknown
        headers: Record<string, string | string[]>
        status: number
      }
      cause?: unknown
      config?: HttpErrorRequestConfig
    },
  ) {
    super(message, options)
    const { config, response } = options
    this.name = 'HttpError'
    this.response = {
      ...response,
      data: redactValue(response.data),
      headers: redactHeaders(response.headers),
    }
    this.config =
      config === undefined
        ? config
        : {
            ...config,
            ...(config.data !== undefined && {
              data: redactValue(config.data),
            }),
            ...(config.headers !== undefined && {
              headers: redactHeaders(config.headers),
            }),
            ...(config.params !== undefined && {
              params: redactParams(config.params),
            }),
            // A token can ride inline in the URL (`?code=…`) rather
            // than in `params`; the query string is redacted like any
            // other form-encoded carrier.
            ...(config.url !== undefined && { url: redactUrl(config.url) }),
          }
  }
}

/**
 * Type guard for HTTP errors thrown by the internal HTTP client.
 * @param error - Value caught from a failed HTTP request.
 * @returns Whether the value is an HttpError.
 * @category HTTP
 */
export const isHttpError = (error: unknown): error is HttpError =>
  error instanceof HttpError
