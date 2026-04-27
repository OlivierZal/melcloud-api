/** Snapshot of the request that triggered an {@link HttpError}. */
export interface HttpErrorRequestConfig {
  readonly data?: unknown
  readonly headers?: Record<string, string>
  readonly method?: string
  readonly params?: Record<string, unknown>
  readonly url?: string
}

/**
 * Thrown by {@link HttpClient} whenever an upstream response has a non-2xx
 * status. The shape mirrors what downstream code needs: `response.status`,
 * `response.headers`, and `response.data` — identical to the relevant
 * surface of the previous `AxiosError` contract so retry/rate-limit logic
 * does not need to branch on the error's origin.
 */
export class HttpError<T = unknown> extends Error {
  public readonly config: HttpErrorRequestConfig | undefined

  public readonly isHttpError = true

  public readonly response: {
    readonly data: T
    readonly headers: Record<string, string | string[]>
    readonly status: number
  }

  public constructor(
    message: string,
    response: {
      data: T
      headers: Record<string, string | string[]>
      status: number
    },
    config?: HttpErrorRequestConfig,
  ) {
    super(message)
    this.name = 'HttpError'
    this.response = response
    this.config = config
  }
}

/**
 * Type guard for HTTP errors thrown by the internal HTTP client.
 * @param error - Value caught from a failed HTTP request.
 * @returns Whether the value is an HttpError.
 */
export const isHttpError = (error: unknown): error is HttpError =>
  error instanceof HttpError
