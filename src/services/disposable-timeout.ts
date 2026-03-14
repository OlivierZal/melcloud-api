export class DisposableTimeout implements Disposable {
  #timeout: ReturnType<typeof setTimeout> | undefined

  public get isActive(): boolean {
    return this.#timeout !== undefined
  }

  public clear(): void {
    if (this.#timeout !== undefined) {
      clearTimeout(this.#timeout)
      this.#timeout = undefined
    }
  }

  public [Symbol.dispose](): void {
    this.clear()
  }

  public schedule(callback: () => void, ms: number): void {
    this.clear()
    this.#timeout = setTimeout(callback, ms)
  }
}
