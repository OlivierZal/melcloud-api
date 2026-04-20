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

  #safeInvoke(callback: string, invoke: () => void): void {
    try {
      invoke()
    } catch (error) {
      this.#logger.error(
        `LifecycleEvents.${callback} callback threw — ignoring`,
        error,
      )
    }
  }
}
