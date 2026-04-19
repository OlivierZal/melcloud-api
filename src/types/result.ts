/** Failed outcome carrying a typed error description. */
export interface Failure<TError> {
  readonly error: TError
  readonly ok: false
}

/**
 * Discriminated result for best-effort SDK calls whose failure modes
 * carry information the caller should be able to branch on.
 *
 * `T | null` — the prior return shape for {@link HomeAPI.getEnergy}
 * and friends — lies to consumers: a `null` could mean "empty
 * window", "token expired", "transient 5xx", "shape drift" or
 * "unreachable". Modern consumers (retry strategies, UI error
 * banners, debug overlays) need the distinction; the SDK
 * previously exposed it only via `logger.error`, out of band.
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
// eslint-disable-next-line unicorn/prevent-abbreviations -- paired with `ok` — `error` would collide with the local catch binding at call sites
export const err = <TError>(error: TError): Failure<TError> => ({
  error,
  ok: false,
})

/**
 * Discriminated failure class emitted by HomeAPI best-effort getters
 * ({@link HomeAPI.getEnergy}, {@link HomeAPI.getSignal},
 * {@link HomeAPI.getTemperatures}, {@link HomeAPI.getErrorLog}).
 *
 * Each variant carries enough context for a caller to decide how
 * to react — distinguishing "retry this later" from "wipe the
 * session" from "surface to user" without inspecting the logger:
 * - `network`: transport-level failure (ECONNRESET, timeout, DNS).
 *   Transient; safe to retry.
 * - `unauthorized`: server rejected the credential mid-flight. A
 *   full reauth via {@link HomeAPI.resumeSession} is typically
 *   needed before retrying.
 * - `rate-limited`: the SDK's internal rate-limit gate refused the
 *   call. `retryAfterMs` is the remaining milliseconds on the
 *   pause, or `null` when the upstream header did not carry a
 *   duration.
 * - `validation`: Zod refused the response shape. Indicates API
 *   drift server-side; not retryable on its own — investigate.
 * - `server`: any other HTTP error from the transport.
 */
export type HomeError =
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
