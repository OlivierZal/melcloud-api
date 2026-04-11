import { DisposableTimeout } from '../resilience/index.ts'
import type { Logger } from './interfaces.ts'

const MILLISECONDS_PER_MINUTE = 60_000

/**
 * Manages periodic auto-sync with a configurable interval.
 * Shared between MELCloudAPI and MELCloudHomeAPI.
 */
export class SyncManager implements Disposable {
  #interval: number

  readonly #logger: Logger

  readonly #syncFunction: () => Promise<unknown>

  readonly #timeout = new DisposableTimeout()

  public constructor(
    syncFunction: () => Promise<unknown>,
    logger: Logger,
    intervalMinutes: number | null = 0,
  ) {
    this.#syncFunction = syncFunction
    this.#logger = logger
    this.#interval = (intervalMinutes ?? 0) * MILLISECONDS_PER_MINUTE
  }

  public clear(): void {
    this.#timeout.clear()
  }

  public planNext(): void {
    if (this.#interval) {
      this.#timeout.schedule(() => {
        this.#syncFunction().catch((error: unknown) => {
          this.#logger.error('Auto-sync failed:', error)
        })
      }, this.#interval)
    }
  }

  public [Symbol.dispose](): void {
    this.#timeout[Symbol.dispose]()
  }

  public setInterval(minutes: number | null): void {
    this.#interval = (minutes ?? 0) * MILLISECONDS_PER_MINUTE
    this.clear()
    this.planNext()
  }
}
