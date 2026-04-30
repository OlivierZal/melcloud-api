/** Failed outcome carrying a typed {@link ApiRequestError}. */
export interface Failure {
  readonly error: ApiRequestError
  readonly ok: false
}

/**
 * Discriminated outcome for best-effort SDK calls. The success branch
 * carries the parsed value; the failure branch carries an
 * {@link ApiRequestError} variant the caller can branch on (retry on
 * `network`, refresh on `unauthorized`, surface on `validation`, etc.)
 * — distinctions a flat `T | null` would collapse.
 *
 * The error type is fixed to {@link ApiRequestError} rather than
 * generic: every call site in the SDK fails through the same
 * classification pipeline, so a `<TError>` parameter would be a
 * degree of freedom nothing exercises. General-purpose Result
 * libraries (neverthrow, ts-results) keep it generic because they
 * cannot assume a single domain; domain-specific SDKs lock it.
 */
export type Result<T> = Failure | Success<T>

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
export const err = (error: ApiRequestError): Failure => ({
  error,
  ok: false,
})

/**
 * Transform the success branch of a {@link Result} while passing the
 * failure branch through unchanged. The standard "functor map" operation
 * from neverthrow / ts-results / oxide; lets callers compose
 * Result-returning calls with synchronous transforms (e.g.
 * `mapResult(await api.getEnergy(...), getChartLineOptions)`) without
 * unwrapping then re-wrapping by hand.
 * @param result - The {@link Result} to transform.
 * @param fn - Pure function applied to the success value.
 * @returns A new {@link Result} with the transformed value (success
 * branch) or the original error (failure branch).
 */
export const mapResult = <T, TResult>(
  result: Result<T>,
  fn: (value: T) => TResult,
): Result<TResult> => (result.ok ? ok(fn(result.value)) : result)

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
 * neutral type via `Result<T>`.
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
