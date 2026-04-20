import { HTTP_STATUS_UNAUTHORIZED, isHttpError } from '../http/index.ts'
import type { ResiliencePolicy } from './policy.ts'
import type { RetryGuard } from './retry-guard.ts'

/**
 * Reactive authentication retry. On a `401 Unauthorized`:
 * 1. **Gate** the retry via a shared {@link RetryGuard} — only one
 *    retry per guard window, so a repeatedly-rejected credential
 *    doesn't spin forever.
 * 2. **Reauthenticate** through the subclass-provided hook. The hook
 *    returns `true` if the session was successfully refreshed (token
 *    exchange or full `resumeSession`) and `false` if it failed.
 * 3. **Replay** the original attempt exactly once on a successful
 *    reauth. Any other outcome re-throws the original 401.
 *
 * Ownership: only 401 errors. Non-401 HTTP errors, network errors,
 * and anything not from `HttpError` propagate unchanged so inner /
 * outer policies can handle them in isolation.
 */
export class AuthRetryPolicy implements ResiliencePolicy {
  readonly #guard: RetryGuard

  readonly #reauthenticate: () => Promise<boolean>

  public constructor(
    guard: RetryGuard,
    reauthenticate: () => Promise<boolean>,
  ) {
    this.#guard = guard
    this.#reauthenticate = reauthenticate
  }

  public async run<T>(attempt: () => Promise<T>): Promise<T> {
    try {
      return await attempt()
    } catch (error) {
      if (!this.#shouldRetry(error)) {
        throw error
      }
      if (!(await this.#reauthenticate())) {
        throw error
      }
      return attempt()
    }
  }

  #shouldRetry(error: unknown): boolean {
    return (
      isHttpError(error) &&
      error.response.status === HTTP_STATUS_UNAUTHORIZED &&
      this.#guard.tryConsume()
    )
  }
}
