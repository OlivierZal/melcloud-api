import { DisposableTimeout } from './disposable-timeout.ts'

/**
 * One-shot retry budget limiter.
 *
 * Allows at most one retry per configured window. `tryConsume()` returns
 * `true` when the budget is available (and schedules a refill timer),
 * `false` otherwise. Used by API clients to cap reactive re-authentication
 * attempts on 401 responses and prevent tight retry loops.
 */
export class RetryGuard implements Disposable {
  /**
   * Whether a retry window is currently open (a previous attempt is in flight).
   * @returns `true` if the guard is holding a pending retry window, `false` otherwise.
   */
  public get isActive(): boolean {
    return this.#timeout.isActive
  }

  readonly #delay: number

  readonly #timeout = new DisposableTimeout()

  public constructor(delayMs: number) {
    this.#delay = delayMs
  }

  /** Cancel the current retry window on disposal, preventing leaked timers. */
  public [Symbol.dispose](): void {
    this.#timeout[Symbol.dispose]()
  }

  /**
   * Attempt to consume the retry budget.
   * @returns `true` if the caller may proceed with a retry, `false` if the
   *   budget is exhausted for the current window.
   */
  public tryConsume(): boolean {
    if (this.#timeout.isActive) {
      return false
    }
    this.#timeout.schedule(() => {
      // Refill: the guard becomes inactive once the delay elapses.
    }, this.#delay)
    return true
  }
}
