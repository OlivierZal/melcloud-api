/**
 * Disposable wrapper around `setTimeout` for internal background
 * bookkeeping (auto-sync cadence, retry-guard cooldown). Auto-clears
 * the previous timeout when rescheduled and unrefs the underlying
 * handle so a scheduled callback never keeps the Node event loop
 * alive on its own — callers are still notified on the regular loop,
 * but a script that has nothing left to do can exit immediately.
 */
export class DisposableTimeout implements Disposable {
  /**
   * Whether a timeout is currently scheduled and has not yet fired or been cleared.
   * @returns `true` if a timeout is pending.
   */
  public get isActive(): boolean {
    return this.#timeout !== undefined
  }

  #timeout?: ReturnType<typeof setTimeout>

  /** Cancel the current timeout if one is active. */
  public clear(): void {
    if (this.#timeout !== undefined) {
      clearTimeout(this.#timeout)
      this.#timeout = undefined
    }
  }

  /** Clear the timeout on disposal, preventing leaked timers. */
  public [Symbol.dispose](): void {
    this.clear()
  }

  /**
   * Schedule a callback after `ms` milliseconds, replacing any existing timeout.
   * @param callback - The function to invoke when the timeout fires.
   * @param ms - The delay in milliseconds before invoking the callback.
   */
  public schedule(callback: () => void, ms: number): void {
    this.clear()
    // Auto-clear after firing so isActive reflects the actual state
    this.#timeout = setTimeout(() => {
      this.#timeout = undefined
      callback()
    }, ms)
    this.#timeout.unref()
  }
}
