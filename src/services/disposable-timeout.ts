/** A disposable wrapper around `setTimeout` that automatically clears the previous timeout when rescheduled. */
export class DisposableTimeout implements Disposable {
  #timeout: ReturnType<typeof setTimeout> | undefined

  /** Whether a timeout is currently scheduled and has not yet fired or been cleared. */
  public get isActive(): boolean {
    return this.#timeout !== undefined
  }

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

  /** Schedule a callback after `ms` milliseconds, replacing any existing timeout. */
  public schedule(callback: () => void, ms: number): void {
    this.clear()
    // Auto-clear after firing so isActive reflects the actual state
    this.#timeout = setTimeout(() => {
      this.#timeout = undefined
      callback()
    }, ms)
  }
}
