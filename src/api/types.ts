import type {
  LifecycleEvents as CoreLifecycleEvents,
  SyncCallback as CoreSyncCallback,
  Logger,
  SettingManager,
} from '@olivierzal/api-core'

import type { DeviceType } from '../constants.ts'
import type { HttpClient } from '../http/index.ts'
import type { LoginCredentials, UndefinedTolerant } from '../types/index.ts'

/**
 * Parameters carried by this SDK's sync notification: the device-type
 * filter and any ids the cascade was scoped to.
 * @category Configuration
 */
interface SyncParams {
  ids?: (number | string)[] | undefined
  type?: DeviceType | undefined
}

/**
 * Session and infrastructure surface shared by both dialects' API
 * adapters — the cross-dialect base a consumer can program against
 * without knowing which wire it talks to.
 * @category API
 */
export interface BaseAPIAdapter {
  /**
   * Whether the client is currently inside a server rate-limit backoff.
   */
  readonly isRateLimited: boolean
  /**
   * BCP-47 locale tag the instance was configured with, or `undefined`.
   */
  readonly locale: string | undefined
  /**
   * IANA timezone the instance was configured with, or `undefined`.
   */
  readonly timezone: string | undefined
  /**
   * Sign in with explicit credentials; throws on rejection.
   */
  readonly authenticate: (credentials: LoginCredentials) => Promise<void>
  /**
   * Cancel any pending automatic sync.
   */
  readonly clearSync: () => void
  /**
   * Sync check first; when it reads `false`, one best-effort
   * {@link resumeSession} probe, then a re-check — the lazy self-heal
   * consumers otherwise hand-roll (a valid persisted Home token reads
   * unauthenticated until a context fetch has run).
   */
  readonly ensureAuthenticated: () => Promise<boolean>
  /**
   * Whether a session is currently usable, from local state alone.
   */
  readonly isAuthenticated: () => boolean
  /**
   * Explicit sign-out: clears the persisted session material.
   */
  readonly logOut: () => void
  /**
   * Best-effort session restore from persisted credentials. Never
   * throws — returns `false` when no credentials are persisted or
   * sign-in fails (logged via the SDK logger).
   */
  readonly resumeSession: () => Promise<boolean>
  /**
   * Update the automatic sync interval and reschedule. Pass `false` to disable.
   */
  readonly setSyncInterval: (minutes: number | false) => void
}

/**
 * Common configuration shared by all API clients. Every property —
 * including the inherited {@link LoginCredentials} pair — may be
 * absent or explicitly `undefined`, interchangeably: the runtime
 * applies the same default either way (credentials can also arrive
 * later via `authenticate` or the {@link SettingManager}).
 * @category Configuration
 */
export interface BaseAPIConfig extends UndefinedTolerant<LoginCredentials> {
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
  readonly abortSignal?: AbortSignal | undefined
  /**
   * Structured-events callbacks invoked around SDK lifecycle moments.
   * Useful to plug the SDK into a host observability stack
   * (pino / winston / OpenTelemetry / custom metrics).
   */
  readonly events?: LifecycleEvents | undefined
  /**
   * Custom logger. Defaults to `console`.
   */
  readonly logger?: Logger | undefined
  /**
   * External setting manager for persisting credentials and session data.
   */
  readonly settingManager?: SettingManager | undefined
  /**
   * Restore the persisted session in the background instead of awaiting
   * it inside `create()`. Session probing and full logins can take tens
   * of seconds on slow networks, which blows a host app's init budget
   * (e.g. Homey's 30 s `ready` timeout). The lifecycle contract is
   * unchanged — auto-sync arming, `onAuthenticationLost`, login
   * backoff — it just runs off the critical path; `isAuthenticated()`
   * may report `false` until the background restore lands.
   */
  readonly shouldResumeSessionInBackground?: boolean | undefined
  /**
   * Auto-sync timer in minutes. `false` disables the timer entirely
   * (manual `list()` / `fetch()` only). Omit to use the subclass
   * default (1 for Home, 5 for Classic).
   */
  readonly syncIntervalMinutes?: number | false | undefined
  /**
   * HTTP transport: pre-built {@link HttpClient} or build options.
   */
  readonly transport?: TransportConfig | undefined
}

/**
 * Session material both dialects persist through the host's
 * {@link SettingManager}: credentials, expiry, and the login-backoff
 * gate (previously undeclared — a host clearing every declared key
 * left the backoff behind).
 * @category API
 */
export interface BaseAPISettings {
  /**
   * Session expiry timestamp in ISO 8601 format.
   */
  readonly expiry?: string | null
  /**
   * Epoch-ms deadline before which automatic re-logins are refused.
   */
  readonly loginBackoffUntil?: string | null
  /**
   * Account password.
   */
  readonly password?: string | null
  /**
   * Account username (email).
   */
  readonly username?: string | null
}

/**
 * Callback bundle invoked around SDK lifecycle moments — the core's
 * `LifecycleEvents` instantiated with this SDK's `SyncParams`. All
 * callbacks are optional and non-throwing.
 * @category Configuration
 */
export type LifecycleEvents = CoreLifecycleEvents<SyncParams>

/**
 * Callback invoked after sync operations — the core's `SyncCallback`
 * instantiated with this SDK's `SyncParams`.
 * @category Configuration
 */
export type SyncCallback = CoreSyncCallback<SyncParams>

/**
 * Transport configuration. Discriminated by presence of an
 * {@link HttpClient} instance — the SDK either reuses your wired client
 * (with its own dispatcher, headers, timeout) or builds a fetch-backed
 * default whose timeout you can tweak via `timeoutMs`.
 * @category Configuration
 */
export type TransportConfig =
  | HttpClient
  | {
      /**
       * Maximum time in milliseconds for a single HTTP request before
       * it is aborted. Defaults to 30 000 ms (30 s). Pass `0` to
       * disable the timeout (not recommended).
       */
      readonly timeoutMs?: number | undefined
    }

export type {
  Logger,
  RequestCompleteEvent,
  RequestErrorEvent,
  RequestLifecycleContext,
  RequestRetryEvent,
  RequestStartEvent,
  SettingManager,
} from '@olivierzal/api-core'
