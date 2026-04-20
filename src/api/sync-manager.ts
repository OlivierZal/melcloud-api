import { DisposableTimeout } from '../resilience/index.ts'
import { MS_PER_MINUTE } from '../time-units.ts'
import type { Logger } from './types.ts'

const toIntervalMs = (minutes: number | false): number =>
  minutes === false ? 0 : minutes * MS_PER_MINUTE

/**
 * Manages periodic auto-sync with a configurable interval.
 * Shared between ClassicAPI and HomeAPI.
 */
export class SyncManager implements Disposable {
  #interval: number

  readonly #logger: Logger

  readonly #syncFunction: () => Promise<unknown>

  readonly #timeout = new DisposableTimeout()

  public constructor(
    syncFunction: () => Promise<unknown>,
    logger: Logger,
    intervalMinutes: number | false = false,
  ) {
    this.#syncFunction = syncFunction
    this.#logger = logger
    this.#interval = toIntervalMs(intervalMinutes)
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

  public setInterval(minutes: number | false): void {
    this.#interval = toIntervalMs(minutes)
    this.clear()
    this.planNext()
  }
}
