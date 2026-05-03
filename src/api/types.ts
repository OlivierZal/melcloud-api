import type { DeviceType } from '../constants.ts'
import type { HttpClient } from '../http/index.ts'
import type { LoginCredentials } from '../types/index.ts'

/**
 * Common configuration shared by all API clients.
 * @category Configuration
 */
export interface BaseAPIConfig extends Partial<LoginCredentials> {
  /**
   * Optional shutdown signal applied to every outgoing request.
   *
   * When the signal fires, all in-flight HTTP requests abort with a
   * DOMException of name `AbortError`. Subsequent calls from the same
   * client instance will also abort immediately. Use this to tie the
   * SDK lifetime to a host process lifetime — e.g. pass the Homey
   * app's shutdown signal so outstanding requests don't dangle across
   * a reload.
   */
  readonly abortSignal?: AbortSignal
  /**
   * Structured-events callbacks invoked around SDK lifecycle moments.
   * Useful to plug the SDK into a host observability stack
   * (pino / winston / OpenTelemetry / custom metrics).
   */
  readonly events?: LifecycleEvents
  /** Custom logger. Defaults to `console`. */
  readonly logger?: Logger
  /** External setting manager for persisting credentials and session data. */
  readonly settingManager?: SettingManager
  /**
   * Auto-sync timer in minutes. `false` disables the timer entirely
   * (manual `list()` / `fetch()` only). Omit to use the subclass
   * default (1 for Home, 5 for Classic).
   */
  readonly syncIntervalMinutes?: number | false
  /** HTTP transport: pre-built {@link HttpClient} or build options. */
  readonly transport?: TransportConfig
}

/**
 * Callback bundle invoked around SDK lifecycle moments. All callbacks
 * are optional and non-throwing — the SDK ignores any exceptions they
 * raise so a buggy observer cannot break the request flow.
 *
 * Two scopes coexist here:
 * - **Per-request** (`onRequest*`) — fires for every outgoing HTTP call.
 * - **Per-sync** (`onSyncComplete`) — fires after each sync trigger
 *   (auto-timer OR a `@syncDevices`-decorated mutation), once the
 *   downstream device state has been refreshed.
 * @category Configuration
 */
export interface LifecycleEvents {
  /**
   * Invoked after each sync trigger (auto-timer or
   * `@syncDevices`-decorated mutation). Receives the device-type
   * filter and any IDs the cascade was scoped to.
   */
  readonly onSyncComplete?: SyncCallback
  /** Invoked after a successful HTTP response is received. */
  readonly onRequestComplete?: (event: RequestCompleteEvent) => void
  /** Invoked when a request fails permanently (retries exhausted). */
  readonly onRequestError?: (event: RequestErrorEvent) => void
  /** Invoked before each backoff-scheduled retry attempt. */
  readonly onRequestRetry?: (event: RequestRetryEvent) => void
  /** Invoked when a request is dispatched for the first time. */
  readonly onRequestStart?: (event: RequestStartEvent) => void
}

/**
 * Logger interface for API call tracing.
 * @category Configuration
 */
export interface Logger {
  /** Log error messages. */
  readonly error: Console['error']
  /** Log informational messages. */
  readonly log: Console['log']
}

/**
 * Emitted when a request (possibly after retries) completes successfully.
 * @category Configuration
 */
export interface RequestCompleteEvent extends RequestLifecycleContext {
  /** Elapsed time in milliseconds, including any retry delays. */
  readonly durationMs: number
  /** Final HTTP status code returned by the upstream server. */
  readonly status: number
}

/**
 * Emitted when a request ultimately fails after exhausting its retries.
 * @category Configuration
 */
export interface RequestErrorEvent extends RequestLifecycleContext {
  /** Elapsed time in milliseconds, including any retry delays. */
  readonly durationMs: number
  /** The terminal error thrown by the request. */
  readonly error: unknown
}

/**
 * Identifies a single logical request across its lifecycle events.
 * Generated client-side via `crypto.randomUUID()` when each request
 * starts, so consumers can correlate a `onRequestStart` with its
 * eventual `onRequestComplete` or `onRequestError` — including across
 * retry attempts, which share the same `correlationId`.
 * @category Configuration
 */
export interface RequestLifecycleContext {
  /** Unique request identifier (UUID v4). */
  readonly correlationId: string
  /** HTTP method, uppercase. */
  readonly method: string
  /** Request URL (possibly relative to the client's baseURL). */
  readonly url: string
}

/**
 * Emitted each time a retry attempt is scheduled.
 * @category Configuration
 */
export interface RequestRetryEvent extends RequestLifecycleContext {
  /** 1-based retry attempt number (1 = first retry, not the initial try). */
  readonly attempt: number
  /** Backoff delay in milliseconds before this retry fires. */
  readonly delayMs: number
  /** The error that triggered the retry. */
  readonly error: unknown
}

/**
 * Emitted at the start of a request, before any retry attempts.
 * @category Configuration
 */
export type RequestStartEvent = RequestLifecycleContext

/**
 * External storage adapter for persisting API session settings.
 * @category Configuration
 */
export interface SettingManager {
  /** Retrieve a setting value by key. Returns the stored value, or `null`/`undefined` if absent. */
  readonly get: (key: string) => string | null | undefined
  /** Store a setting value by key. */
  readonly set: (key: string, value: string) => void
}

/**
 * Callback invoked after sync operations, with optional device IDs and type filter.
 * @category Configuration
 */
export type SyncCallback = (params?: {
  ids?: (number | string)[]
  type?: DeviceType
}) => Promise<void>

/**
 * Transport configuration. Discriminated by presence of an
 * `HttpClient` instance — the SDK either reuses your wired client
 * (with its own dispatcher, headers, timeout) or builds a fetch-backed
 * default whose timeout you can tweak via `timeoutMs`.
 * @internal
 */
export type TransportConfig =
  | HttpClient
  | {
      /**
       * Maximum time in milliseconds for a single HTTP request before
       * it is aborted. Defaults to 30 000 ms (30 s). Pass `0` to
       * disable the timeout (not recommended).
       */
      readonly timeoutMs?: number
    }
