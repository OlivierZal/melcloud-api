import type {
  Logger,
  RequestCompleteEvent,
  RequestErrorEvent,
  RequestLifecycleEvents,
  RequestRetryEvent,
  RequestStartEvent,
} from '../services/interfaces.ts'

/**
 * Thin wrapper around a {@link RequestLifecycleEvents} bundle that
 * swallows any exceptions raised by consumer callbacks and logs them
 * at error level. A misbehaving observer must never be able to break
 * the request flow — observability is a side concern, never a blocker.
 */
export class RequestLifecycleEmitter {
  readonly #events: RequestLifecycleEvents | undefined

  readonly #logger: Logger

  public constructor(
    events: RequestLifecycleEvents | undefined,
    logger: Logger,
  ) {
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

  #safeInvoke(callback: string, invoke: () => void): void {
    try {
      invoke()
    } catch (error) {
      this.#logger.error(
        `RequestLifecycleEvents.${callback} callback threw — ignoring`,
        error,
      )
    }
  }
}
