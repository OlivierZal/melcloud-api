import type { DeviceType } from '../constants.ts'
import type { ClassicLoginCredentials } from '../types/index.ts'

/** Common configuration shared by all API clients. */
export interface BaseAPIConfig extends Partial<ClassicLoginCredentials> {
  /**
   * Optional shutdown signal applied to every outgoing request.
   *
   * When the signal fires, all in-flight HTTP requests are aborted
   * (axios rejects with `ERR_CANCELED`). Subsequent calls from the
   * same client instance will also abort immediately. Use this to
   * tie the SDK lifetime to a host process lifetime — e.g. pass the
   * Homey app's shutdown signal so outstanding requests don't dangle
   * across a reload.
   */
  readonly abortSignal?: AbortSignal

  /** Interval in minutes between automatic syncs. Set to `null` to disable. */
  readonly autoSyncInterval?: number | null

  /**
   * Structured-events callbacks invoked around the request lifecycle.
   * Useful to plug the SDK into a host observability stack
   * (pino / winston / OpenTelemetry / custom metrics).
   */
  readonly events?: RequestLifecycleEvents

  /** Custom logger. Defaults to `console`. */
  readonly logger?: Logger

  /** Callback invoked after sync operations. */
  readonly onSync?: SyncCallback

  /**
   * Maximum time in milliseconds for a single HTTP request before
   * axios aborts it. Defaults to 30 000 ms (30 s). Set to `0` to
   * disable the timeout (not recommended).
   */
  readonly requestTimeout?: number

  /** External setting manager for persisting credentials and session data. */
  readonly settingManager?: SettingManager
}

/**
 * Identifies a single logical request across its lifecycle events.
 * Generated client-side via `crypto.randomUUID()` when each request
 * starts, so consumers can correlate a `onRequestStart` with its
 * eventual `onRequestComplete` or `onRequestError` — including across
 * retry attempts, which share the same `correlationId`.
 */
export interface RequestLifecycleContext {
  /** Unique request identifier (UUID v4). */
  readonly correlationId: string

  /** HTTP method, uppercase. */
  readonly method: string

  /** Request URL (possibly relative to the client's baseURL). */
  readonly url: string
}

/** Emitted at the start of a request, before any retry attempts. */
export type RequestStartEvent = RequestLifecycleContext

/** Emitted when a request (possibly after retries) completes successfully. */
export interface RequestCompleteEvent extends RequestLifecycleContext {
  /** Elapsed time in milliseconds, including any retry delays. */
  readonly durationMs: number

  /** Final HTTP status code returned by the upstream server. */
  readonly status: number
}

/** Emitted when a request ultimately fails after exhausting its retries. */
export interface RequestErrorEvent extends RequestLifecycleContext {
  /** Elapsed time in milliseconds, including any retry delays. */
  readonly durationMs: number

  /** The terminal error thrown by the request. */
  readonly error: unknown
}

/** Emitted each time a retry attempt is scheduled. */
export interface RequestRetryEvent extends RequestLifecycleContext {
  /** 1-based retry attempt number (1 = first retry, not the initial try). */
  readonly attempt: number

  /** Backoff delay in milliseconds before this retry fires. */
  readonly delayMs: number

  /** The error that triggered the retry. */
  readonly error: unknown
}

/**
 * Callback bundle invoked around each logical request. All callbacks
 * are optional and non-throwing — the SDK ignores any exceptions they
 * raise so a buggy observer cannot break the request flow.
 */
export interface RequestLifecycleEvents {
  /** Invoked when a request is dispatched for the first time. */
  readonly onRequestStart?: (event: RequestStartEvent) => void

  /** Invoked after a successful HTTP response is received. */
  readonly onRequestComplete?: (event: RequestCompleteEvent) => void

  /** Invoked when a request fails permanently (retries exhausted). */
  readonly onRequestError?: (event: RequestErrorEvent) => void

  /** Invoked before each backoff-scheduled retry attempt. */
  readonly onRequestRetry?: (event: RequestRetryEvent) => void
}

/** Logger interface for API call tracing. */
export interface Logger {
  /** Log error messages. */
  readonly error: Console['error']

  /** Log informational messages. */
  readonly log: Console['log']
}

/** External storage adapter for persisting API session settings. */
export interface SettingManager {
  /** Retrieve a setting value by key. Returns the stored value, or `null`/`undefined` if absent. */
  readonly get: (key: string) => string | null | undefined

  /** Store a setting value by key. */
  readonly set: (key: string, value: string) => void
}

/** Callback invoked after sync operations, with optional device IDs and type filter. */
export type SyncCallback = (params?: {
  ids?: (number | string)[]
  type?: DeviceType
}) => Promise<void>
