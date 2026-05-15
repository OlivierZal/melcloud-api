/** A disposable wrapper around `setTimeout` that automatically clears the previous timeout when rescheduled. */
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
    // Background bookkeeping (auto-sync cadence, retry-guard cooldown) must
    // never keep the Node event loop alive on its own; otherwise a script
    // that just awaits ClassicAPI.create sits idle for ~5 minutes (#1511).
    this.#timeout.unref()
  }
}
