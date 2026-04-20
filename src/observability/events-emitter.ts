import type {
  LifecycleEvents,
  Logger,
  RequestCompleteEvent,
  RequestErrorEvent,
  RequestRetryEvent,
  RequestStartEvent,
  SyncCallback,
} from '../api/interfaces.ts'

/**
 * Thin wrapper around a {@link LifecycleEvents} bundle that swallows
 * any exceptions raised by consumer callbacks and logs them at error
 * level. A misbehaving observer must never be able to break the
 * request or sync flow — observability is a side concern, never a
 * blocker.
 */
export class LifecycleEmitter {
  readonly #events?: LifecycleEvents

  readonly #logger: Logger

  public constructor(events: LifecycleEvents | undefined, logger: Logger) {
    this.#events = events
    this.#logger = logger
  }

  public emitComplete(event: RequestCompleteEvent): void {
    this.#safeInvoke('onRequestComplete', () =>
      this.#events?.onRequestComplete?.(event),
    )
  }

  public emitError(event: RequestErrorEvent): void {
    this.#safeInvoke('onRequestError', () =>
      this.#events?.onRequestError?.(event),
    )
  }

  public emitRetry(event: RequestRetryEvent): void {
    this.#safeInvoke('onRequestRetry', () =>
      this.#events?.onRequestRetry?.(event),
    )
  }

  public emitStart(event: RequestStartEvent): void {
    this.#safeInvoke('onRequestStart', () =>
      this.#events?.onRequestStart?.(event),
    )
  }

  public async emitSyncComplete(
    ...args: Parameters<SyncCallback>
  ): Promise<void> {
    const callback = this.#events?.onSyncComplete
    if (callback === undefined) {
      return
    }
    try {
      await callback(...args)
    } catch (error) {
      this.#logger.error(
        'LifecycleEvents.onSyncComplete callback threw — ignoring',
        error,
      )
    }
  }

  #safeInvoke(callback: string, invoke: () => unknown): void {
    /*
     * Catch BOTH synchronous throws and async rejections. The
     * `onRequest*` signatures are typed `(event) => void`, but TS's
     * structural assignability lets callers pass `async () => …`
     * (a `() => Promise<void>` is assignable to `() => void`).
     * `invoke` is widened to `() => unknown` so we can detect when
     * the runtime return is a Promise and chain `.catch` onto it —
     * otherwise a rejected promise escapes as an unhandled rejection
     * and breaks the "non-throwing observer" contract this emitter
     * is meant to enforce.
     */
    try {
      const result = invoke()
      if (result instanceof Promise) {
        result.catch((error: unknown) => {
          this.#logger.error(
            `LifecycleEvents.${callback} callback rejected — ignoring`,
            error,
          )
        })
      }
    } catch (error) {
      this.#logger.error(
        `LifecycleEvents.${callback} callback threw — ignoring`,
        error,
      )
    }
  }
}
