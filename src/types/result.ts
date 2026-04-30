/** Failed outcome carrying a typed error description. */
export interface Failure<TError> {
  readonly error: TError
  readonly ok: false
}

/**
 * Discriminated result for best-effort SDK calls whose failure modes
 * carry information the caller should be able to branch on.
 *
 * `T | null` — the prior return shape for `getEnergy` and friends — lies
 * to consumers: a `null` could mean "empty window", "token expired",
 * "transient 5xx", "shape drift" or "unreachable". Modern consumers
 * (retry strategies, UI error banners, debug overlays) need the
 * distinction; the SDK previously exposed it only via `logger.error`,
 * out of band.
 *
 * A `Result<T, TError>` makes the error class part of the type, so
 * `result.ok ? result.value : result.error.kind` is typeable
 * end-to-end. Policies and decorators that produce typed failures
 * return the same shape, keeping the call-site pattern uniform.
 */
export type Result<T, TError> = Failure<TError> | Success<T>

/** Successful outcome carrying the parsed value. */
export interface Success<T> {
  readonly ok: true
  readonly value: T
}

/**
 * Construct a {@link Success}.
 * @param value - The parsed payload to wrap.
 * @returns A `{ ok: true, value }` success outcome.
 */
export const ok = <T>(value: T): Success<T> => ({ ok: true, value })

/**
 * Construct a {@link Failure}.
 * @param error - The typed failure description to wrap.
 * @returns A `{ ok: false, error }` failure outcome.
 */
export const err = <TError>(error: TError): Failure<TError> => ({
  error,
  ok: false,
})

/**
 * Unwrap a {@link Result}: return the value on success, or throw the
 * underlying `cause` (preserving the original exception class) when
 * present, falling back to a synthetic `Error` for the variants that
 * carry no cause (`rate-limited`).
 *
 * The helper exists so facades can preserve their throw-on-failure
 * contract while the underlying SDK methods expose the typed
 * {@link Result} surface to power users who want to branch on the
 * failure variant directly.
 * @param result - The {@link Result} to unwrap.
 * @returns The success value.
 * @throws The original `cause` exception, or an `Error` synthesised
 * from the failure variant.
 */
export const unwrapOrThrow = <T>(result: Result<T, ApiRequestError>): T => {
  if (result.ok) {
    return result.value
  }
  const { error } = result
  if ('cause' in error && error.cause instanceof Error) {
    throw error.cause
  }
  throw new Error(`API request failed: ${error.kind}`)
}

/**
 * Discriminated failure class emitted by the SDK's best-effort getters
 * (Classic + Home telemetry, reports, and settings reads).
 *
 * Each variant carries enough context for a caller to decide how to
 * react — distinguishing "retry this later" from "wipe the session"
 * from "surface to user" without inspecting the logger:
 * - `network`: transport-level failure (ECONNRESET, timeout, DNS).
 *   Transient; safe to retry.
 * - `unauthorized`: server rejected the credential mid-flight. A full
 *   reauth is typically needed before retrying.
 * - `rate-limited`: the SDK's internal rate-limit gate refused the
 *   call. `retryAfterMs` is the remaining milliseconds on the pause,
 *   or `null` when the upstream header did not carry a duration.
 * - `validation`: Zod refused the response shape. Indicates API drift
 *   server-side; not retryable on its own — investigate.
 * - `server`: any other HTTP error from the transport.
 *
 * Classic and Home share the same error space (same transport layer,
 * same resilience policies); both surfaces reference this single
 * neutral type via `Result<T, ApiRequestError>`.
 */
export type ApiRequestError =
  | {
      readonly issue: string
      readonly kind: 'validation'
      readonly cause?: unknown
    }
  | { readonly kind: 'network'; readonly cause?: unknown }
  | { readonly kind: 'rate-limited'; readonly retryAfterMs: number | null }
  | {
      readonly kind: 'server'
      readonly status: number
      readonly cause?: unknown
    }
  | { readonly kind: 'unauthorized'; readonly cause?: unknown }
