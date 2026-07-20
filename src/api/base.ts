import { randomUUID } from 'node:crypto'

import type { z } from 'zod'

import { setting } from '../decorators/index.ts'
import {
  AuthenticationError,
  AuthenticationThrottledError,
  RateLimitError,
} from '../errors/index.ts'
import { fireAndForget } from '../fire-and-forget.ts'
import {
  type HttpClientConfig,
  type HttpResponse,
  HttpClient,
  HttpStatus,
  isHttpError,
} from '../http/index.ts'
import {
  APICallRequestData,
  APICallResponseData,
  createAPICallErrorData,
  LifecycleEmitter,
} from '../observability/index.ts'
import {
  type ResiliencePolicy,
  AuthRetryPolicy,
  CompositePolicy,
  RateLimitGate,
  RateLimitPolicy,
  RetryGuard,
  TransientRetryPolicy,
} from '../resilience/index.ts'
import { Temporal } from '../temporal.ts'
import { MS_PER_MINUTE } from '../time-units.ts'
import {
  type ApiRequestError,
  type LoginCredentials,
  type Result,
  err,
  ok,
} from '../types/index.ts'
import { parseOrThrow } from '../validation/index.ts'
import type {
  BaseAPIConfig,
  Logger,
  SettingManager,
  SyncCallback,
} from './types.ts'
import { SyncManager } from './sync-manager.ts'

/**
 * Classify any thrown error into the discriminated {@link ApiRequestError}
 * union surfaced by {@link BaseAPI.safeRequest}.
 *
 * Order matters: domain errors ({@link AuthenticationError}, {@link RateLimitError})
 * are checked before transport errors so a credential rejection isn't
 * misclassified as a `server` failure. Zod parse failures bubble up as
 * `Error` with `name === 'ValidationError'` from {@link parseOrThrow},
 * which is detected here and reported as the `validation` variant.
 * @param error - The thrown value to classify.
 * @returns A typed {@link ApiRequestError}.
 */
export const classifyError = (error: unknown): ApiRequestError => {
  if (error instanceof Error && error.name === 'ValidationError') {
    return { cause: error, issue: error.message, kind: 'validation' }
  }
  if (error instanceof AuthenticationError) {
    return { cause: error, kind: 'unauthorized' }
  }
  if (error instanceof RateLimitError) {
    return {
      kind: 'rate-limited',
      retryAfterMs:
        error.retryAfter === null ?
          null
        : error.retryAfter.total({ unit: 'millisecond' }),
    }
  }
  if (isHttpError(error)) {
    return error.response.status === HttpStatus.Unauthorized ?
        { cause: error, kind: 'unauthorized' }
      : { cause: error, kind: 'server', status: error.response.status }
  }
  return { cause: error, kind: 'network' }
}

/**
 * Narrow a `401 Unauthorized` surfaced by the HTTP client into the
 * shared {@link AuthenticationError} domain type. Subclass
 * `doAuthenticate` implementations call this helper so callers of
 * {@link BaseAPI.authenticate} get a stable error shape regardless of
 * whether the underlying flow was cookie-based (Classic) or
 * bearer-token (Home); any other rejection yields `null` and the
 * caller rethrows its original error.
 * @param error - The error to inspect.
 * @returns An {@link AuthenticationError} for a 401 {@link HttpError}; `null` otherwise.
 */
export const normalizeUnauthorized = (
  error: unknown,
): AuthenticationError | null =>
  isHttpError(error) && error.response.status === HttpStatus.Unauthorized ?
    new AuthenticationError('MELCloud rejected the credentials', {
      cause: error,
    })
  : null

const DEFAULT_TIMEOUT_MS = 30_000

// Cool-down between consecutive auth-retry consumptions on the same
// RetryGuard. Hardcoded because no caller has ever needed to tune it
// — every Classic + Home flow uses the same 1 s value, and adjusting
// it is more likely to mask bugs than reflect a real product need.
const DEFAULT_AUTH_RETRY_COOLDOWN_MS = 1000

// Automatic re-login backoff after a REJECTED sign-in: MELCloud
// throttles logins aggressively (Classic `ErrorId 6`) while staying
// generous with requests on an existing session, so hammering the login
// endpoint keeps a lockout alive. Transport failures do not arm it (the
// normal retry paths handle those); an explicit `authenticate()` — the
// user re-submitting credentials — bypasses the gate and resets it on
// success. The deadline persists through the SettingManager so host
// restarts respect it too — field diagnostics showed four rejected
// Cognito sign-ins within 70 seconds across app restarts, each fresh
// instance re-attempting despite the announced pause.
const LOGIN_BACKOFF_FAILURE_MS = 900_000
const LOGIN_BACKOFF_THROTTLE_MS = 7_200_000

/**
 * Subclass-internal options injected into the {@link BaseAPI}
 * constructor. Distinct from {@link BaseAPIConfig} (the user-facing
 * surface) — these capture **what the subclass knows** that the user
 * doesn't pick (baseURL, rate-limit window, default sync cadence,
 * the sync runner closure).
 */
interface BaseAPIConstructorOptions {
  /** Subclass default for {@link BaseAPIConfig.syncIntervalMinutes}. */
  defaultSyncIntervalMinutes: number | false
  /** Subclass-fixed HTTP defaults (baseURL, optional dispatcher). */
  httpConfig: Omit<HttpClientConfig, 'timeout'>
  /**
   * Label prefixed to every log line (e.g. `[Classic]`): the two
   * clients emit identically-worded lifecycle logs ("Session resume
   * failed", "Automatic sign-ins paused"), so a host running both
   * could not tell which account a diagnostics report was about.
   */
  logLabel: string
  /** Sliding-window length the rate-limit gate observes. */
  rateLimitHours: number
  /** Sync runner the auto-timer drives. */
  syncCallback: () => Promise<unknown>
}

const labelLogger = (logger: Logger, label: string): Logger => ({
  error: (...data: unknown[]): void => {
    logger.error(label, ...data)
  },
  log: (...data: unknown[]): void => {
    logger.log(label, ...data)
  },
})

/**
 * Shared infrastructure for MELCloud API clients.
 *
 * Extracts the common fields, lifecycle management (sync, rate-limit,
 * retry guard, dispose), and credential handling that both ClassicAPI
 * and HomeAPI duplicate.
 */
export abstract class BaseAPI implements Disposable {
  public readonly logger: Logger

  public readonly settingManager?: SettingManager | undefined

  /**
   * Whether the upstream rate-limit gate is currently holding a pause
   * window after a recent 429 `Retry-After` response.
   * @returns `true` while the SDK is intentionally failing fast.
   */
  public get isRateLimited(): boolean {
    return this.rateLimitGate.isPaused
  }

  protected readonly abortSignal?: AbortSignal | undefined

  protected readonly api: HttpClient

  protected readonly events: LifecycleEmitter

  protected readonly rateLimitGate: RateLimitGate

  protected readonly retryGuard: RetryGuard

  @setting
  protected accessor expiry = ''

  // Epoch-ms deadline before which automatic re-logins are refused;
  // `''` means no pause. Persisted like the credentials so the gate
  // survives a host restart.
  @setting
  protected accessor loginBackoffUntil = ''

  @setting
  protected accessor password = ''

  @setting
  protected accessor username = ''

  protected get syncManager(): SyncManager {
    return this.#syncManager
  }

  // Policy instances are created once in the constructor and reused
  // for every request. Stateless w.r.t. individual calls — the shared
  // state (rate-limit gate, retry guard) lives in the policy's
  // injected dependencies, not in the policy itself.
  readonly #authRetryPolicy: AuthRetryPolicy

  // One event per loss episode: rearmed by any cycle observed
  // authenticated again (including the post-auth sync of a re-login).
  #hasEmittedAuthenticationLost = false

  // Bumped by every logOut so async work that was in flight when the
  // user signed out (a background resume, a sync cycle) can detect the
  // sign-out on completion and discard what it stored — the explicit
  // sign-out always wins over work it overlapped.
  #logOutEpoch = 0

  readonly #rateLimitPolicy: RateLimitPolicy

  // Single in-flight refresh handle. Set when the first `ensureSession`
  // call detects an expired session, cleared when the refresh resolves
  // (success or failure). Subsequent concurrent callers await the same
  // promise instead of each triggering their own round-trip — prevents
  // the thundering-herd pattern on token expiry.
  #refreshPromise: Promise<void> | null = null

  readonly #syncManager: SyncManager

  protected constructor(
    {
      abortSignal,
      events,
      logger = console,
      settingManager,
      syncIntervalMinutes,
      transport,
    }: BaseAPIConfig,
    {
      defaultSyncIntervalMinutes,
      httpConfig,
      logLabel,
      rateLimitHours,
      syncCallback,
    }: BaseAPIConstructorOptions,
  ) {
    this.abortSignal = abortSignal
    this.logger = labelLogger(logger, logLabel)
    this.settingManager = settingManager
    this.events = new LifecycleEmitter(events, this.logger)
    this.rateLimitGate = new RateLimitGate({ hours: rateLimitHours })
    this.retryGuard = new RetryGuard(DEFAULT_AUTH_RETRY_COOLDOWN_MS)
    this.api =
      transport instanceof HttpClient ? transport : (
        new HttpClient({
          ...httpConfig,
          timeout: transport?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        })
      )
    this.#syncManager = new SyncManager(
      syncCallback,
      logger,
      syncIntervalMinutes ?? defaultSyncIntervalMinutes,
    )
    this.#authRetryPolicy = new AuthRetryPolicy(this.retryGuard, async () =>
      this.reauthenticate(),
    )
    this.#rateLimitPolicy = new RateLimitPolicy(this.rateLimitGate, this.logger)
  }

  /**
   * Subclass hook: clear every persisted session credential (tokens,
   * context keys, expiry — whatever the API persists). Ownership is
   * deliberately narrow: the base {@link authenticate} template wipes
   * before an explicit login, the reactive-401 path
   * ({@link reauthenticate}) wipes after the server rejected the
   * credential, and {@link logOut} wipes on an explicit sign-out.
   * Nothing else may clear — in particular the {@link tryReuseSession}
   * probe, where a transient failure is indistinguishable from a
   * rejection and must leave the session untouched.
   */
  protected abstract clearPersistedSession(): void

  /**
   * Subclass hook: empty the device/building registry so a logged-out
   * instance exposes no stale devices. Implemented by syncing the
   * registry collections with empty data (the upsert + prune removes
   * every entry).
   */
  protected abstract clearRegistry(): void

  protected abstract doAuthenticate(
    credentials: LoginCredentials,
  ): Promise<void>

  protected abstract getAuthHeaders(): Record<string, string>

  /**
   * Subclass hook: whether any persisted session material exists that
   * makes the {@link tryReuseSession} probe worth attempting (e.g. a
   * non-expired token or a refresh token). A `false` skips the probe
   * without issuing a doomed unauthenticated request.
   */
  protected abstract hasPersistedSession(): boolean

  public abstract isAuthenticated(): boolean

  /**
   * Subclass hook: whether the persisted session needs refreshing
   * before the next request. Implementations typically check
   * `isSessionExpired(this.expiry, aheadMs)` with a non-zero
   * `aheadMs` so refresh fires pre-emptively, keeping the re-auth
   * latency off the request's critical path.
   */
  protected abstract needsSessionRefresh(): boolean

  /**
   * Subclass hook: perform the actual session refresh. Called by
   * {@link ensureSession} when {@link needsSessionRefresh} returns
   * `true`. Errors propagate — the triggering request fails. Use
   * {@link resumeSession} for best-effort behaviour.
   */
  protected abstract performSessionRefresh(): Promise<void>

  /**
   * Subclass hook: refresh the session after a reactive 401, before
   * {@link AuthRetryPolicy} replays the request. Distinct from
   * {@link performSessionRefresh} — this fires *after* the server
   * rejected the current credential, so implementations typically
   * clear persisted tokens first.
   * @returns `true` when authenticated afterwards.
   */
  protected abstract reauthenticate(): Promise<boolean>

  /**
   * Subclass hook: whether the {@link tryReuseSession} probe ended in
   * a reusable state. A `true` promises the {@link initialize}
   * template that the instance is authenticated and the registry has
   * been verified against the server; success semantics differ per
   * API (Classic keys off the persisted credential, Home additionally
   * requires a parsed context), which is why this stays a hook while
   * the probe skeleton lives in {@link tryReuseSession}.
   */
  protected abstract reuseSucceeded(): boolean

  protected abstract syncRegistry(): Promise<void>

  /**
   * Sign in with explicit credentials. Throws
   * {@link AuthenticationError} on rejection (Classic `ClientLogin3`
   * returning `LoginData: null`, Home BFF returning 401, etc.).
   * Successful return guarantees the registry reflects server state
   * — the post-auth sync is enforced here so subclasses cannot
   * forget it.
   *
   * Use {@link resumeSession} for a best-effort restore from
   * persisted credentials that logs + swallows errors.
   * @param credentials - Explicit username/password.
   * @throws {AuthenticationError} when credentials are rejected.
   */
  public async authenticate(credentials: LoginCredentials): Promise<void> {
    const epoch = this.#logOutEpoch
    this.applyCredentials(credentials.username, credentials.password)
    // Explicit login starts from a clean slate — enforced here so no
    // subclass can forget it (mirrors the post-auth sync below).
    this.clearPersistedSession()
    try {
      await this.doAuthenticate(credentials)
    } catch (error) {
      this.#armLoginBackoff(error)
      throw error
    }
    await this.#finishLogin(epoch)
  }

  /** Cancels any pending auto-sync timer; subsequent `setSyncInterval` or `fetch` calls re-arm it. */
  public clearSync(): void {
    this.#syncManager.clear()
  }

  /**
   * Post-construction lifecycle hook. Every subclass `create()`
   * factory must delegate to this method — it is the sole path that
   * guarantees the #1281-class invariant at instance-creation time:
   * a successful return leaves the registry populated whenever
   * credentials or a persisted session are available.
   *
   * Two-branch template:
   * 1. `tryReuseSession` — if the subclass can reuse a
   *    persisted session (and populate the registry in the process),
   *    we are done.
   * 2. Otherwise, {@link resumeSession} runs — best-effort restore
   *    from persisted credentials. Does nothing (silently) if no
   *    credentials are persisted, so the "no creds + no session"
   *    case falls through to a documented empty state.
   *
   * Callers should check {@link isAuthenticated} after `create()`
   * returns if they need to distinguish "empty state" from "ready".
   */
  public async initialize(): Promise<void> {
    if (await this.tryReuseSession()) {
      return
    }
    if (!(await this.resumeSession()) && this.#hasRecoverableState()) {
      this.#emitAuthenticationLostOnce()
    }
  }

  /**
   * Log out: the inverse of {@link authenticate}. Clears the persisted
   * session (tokens/context/expiry), the stored username/password and
   * the automatic-login backoff, stops the auto-sync timer, and empties
   * the registry — so {@link isAuthenticated} reads `false` and no
   * stale devices linger, identically on Classic and Home.
   *
   * User-initiated, so unlike a rejected sign-in it neither arms the
   * backoff nor emits `onAuthenticationLost`. A subsequent
   * {@link authenticate} is the only way back in.
   */
  public logOut(): void {
    this.#logOutEpoch += 1
    this.clearPersistedSession()
    this.username = ''
    this.password = ''
    this.#setLoginBackoffUntil(null)
    this.clearSync()
    this.clearRegistry()
  }

  /**
   * Notify any registered `events.onSyncComplete` observer that a
   * sync just landed. Routed through the lifecycle emitter so a
   * misbehaving callback cannot break the caller. Invoked by the
   * `@syncDevices` decorator after each decorated mutation.
   * @param args - {@link SyncCallback}-shaped payload (`type`, `ids`).
   */
  public async notifySync(...args: Parameters<SyncCallback>): Promise<void> {
    await this.events.emitSyncComplete(...args)
  }

  /**
   * Best-effort session restore from persisted credentials.
   *
   * Reads `username`/`password` from the SettingManager and signs
   * in. Unlike {@link authenticate}, failures are **logged and
   * swallowed** — the method never throws. Use this from lifecycle
   * hooks (init, 401 retry, `ensureSession`) where a stale or
   * missing persisted credential must not crash the caller.
   *
   * On success, the registry is populated (delegates to
   * {@link authenticate}).
   * @returns `true` when a sign-in round-trip succeeded and the
   * instance is now authenticated; `false` for "no persisted
   * credentials" or "sign-in failed" (both indistinguishable by
   * the return value alone — check the logger / `isAuthenticated`
   * if the distinction matters).
   */
  public async resumeSession(): Promise<boolean> {
    if (this.#isLoginBackedOff()) {
      return false
    }
    const credentials = this.resolvePersistedCredentials()
    if (credentials === null) {
      return false
    }
    try {
      await this.authenticate(credentials)
      return true
    } catch (error) {
      this.logger.error('Session resume failed:', error)
      return false
    }
  }

  /** Releases the auto-sync timer and any retry-guard timers; the instance must not be reused after disposal. */
  public [Symbol.dispose](): void {
    this.#syncManager[Symbol.dispose]()
    this.retryGuard[Symbol.dispose]()
  }

  /**
   * Reschedules the auto-sync timer.
   *
   * The timer is `unref`'d, so it never keeps the Node event loop alive
   * on its own — auto-sync still fires on cadence whenever the host
   * application has another reason to stay running (HTTP server, other
   * timers, open streams). Apps that must run indefinitely should
   * provide their own keep-alive (e.g. `setInterval(() => {}, 1 << 30)`
   * or a long-lived server) rather than relying on this timer.
   * @param minutes - Cadence in minutes; pass `false` to disable.
   */
  public setSyncInterval(minutes: number | false): void {
    this.#syncManager.setInterval(minutes)
  }

  /**
   * Run the initial session restore, honoring the configured mode.
   * `initialize()` never rejects by design (probe and resume failures
   * are swallowed and surfaced through the lifecycle events), so the
   * background variant only needs the fire-and-forget form.
   * @param shouldResumeInBackground - When `true`, the restore runs off
   * the caller's critical path and `create()` resolves immediately.
   */
  public async start(shouldResumeInBackground = false): Promise<void> {
    if (shouldResumeInBackground) {
      fireAndForget(
        this.initialize(),
        this.logger,
        'Background session resume failed:',
      )
      return
    }
    await this.initialize()
  }

  protected applyCredentials(username?: string, password?: string): void {
    if (username !== undefined) {
      this.username = username
    }
    if (password !== undefined) {
      this.password = password
    }
  }

  protected async dispatch<T = unknown>(
    method: string,
    url: string,
    config: Record<string, unknown> = {},
  ): Promise<HttpResponse<T>> {
    const { headers: configHeaders, ...rest } = config
    const requestConfig = {
      ...rest,
      headers: {
        ...(typeof configHeaders === 'object' && configHeaders),
        ...this.getAuthHeaders(),
      },
      method,
      ...(this.abortSignal !== undefined && { signal: this.abortSignal }),
      url,
    }
    this.logger.log(String(new APICallRequestData(requestConfig)))
    const response = await this.api.request<T>(requestConfig)
    this.logger.log(String(new APICallResponseData(response, requestConfig)))
    return response
  }

  /**
   * Ensure the persisted session is fresh before letting a request
   * hit the transport. Template method — subclasses do **not**
   * override; they provide {@link needsSessionRefresh} and
   * {@link performSessionRefresh} hooks instead.
   *
   * Two guarantees this method enforces on top of the hooks:
   * 1. **Pre-emptive refresh** — subclass `needsSessionRefresh`
   *    should check expiry with a forward window (`aheadMs`), so the
   *    refresh fires before the token actually expires and no request
   *    ever pays the full re-auth round-trip on its critical path.
   * 2. **Concurrent-refresh deduplication** — the single in-flight
   *    refresh handle (`#refreshPromise`) prevents the thundering-herd
   *    pattern where N concurrent requests each trigger their own
   *    refresh. Only the first caller kicks off the hook; the rest
   *    await the same promise.
   */
  protected async ensureSession(): Promise<void> {
    if (!this.needsSessionRefresh()) {
      return
    }
    // eslint-disable-next-line unicorn/prefer-await -- single-flight memoization: the cleanup must be attached to the shared promise, not awaited here
    this.#refreshPromise ??= this.performSessionRefresh().finally(() => {
      this.#refreshPromise = null
    })
    await this.#refreshPromise
  }

  protected logError(error: unknown): void {
    if (isHttpError(error)) {
      this.logger.error(String(createAPICallErrorData(error)))
    }
  }

  protected async request<T = unknown>(
    method: string,
    url: string,
    config: Record<string, unknown> = {},
  ): Promise<HttpResponse<T>> {
    await this.ensureSession()
    const context = {
      correlationId: randomUUID(),
      method: method.toUpperCase(),
      url,
    }
    const policy = this.#buildPolicy(context)
    const attempt = async (): Promise<HttpResponse<T>> => {
      try {
        return await this.dispatch<T>(method, url, config)
      } catch (error) {
        this.logError(error)
        throw error
      }
    }
    return this.#runWithEvents(context, async () => policy.run(attempt))
  }

  /**
   * Run a request and return the unwrapped response body, throwing on
   * transport failure. Companion to {@link safeRequest} — same shape,
   * same optional Zod validation via `options.schema`, but the
   * throw-on-failure contract appropriate for mutations and required
   * sync paths (fail fast, no Result branching).
   *
   * Three-method API surface:
   * - {@link request} returns the full `HttpResponse<T>` (status,
   *   headers, data) — full transport access for retry policies and
   *   telemetry.
   * - `requestData` strips the envelope and throws on failure — for
   *   mutations and required sync paths.
   * - {@link safeRequest} strips the envelope and Result-wraps failure
   *   — for best-effort getters.
   * @param method - HTTP method (`get`, `post`, …).
   * @param url - Request URL relative to the API base.
   * @param options - Request config plus an optional `schema` peer key.
   * @returns The unwrapped response body, parsed by the schema if one
   * was supplied.
   */
  protected async requestData<T>(
    method: string,
    url: string,
    options: Record<string, unknown> & { readonly schema?: z.ZodType<T> } = {},
  ): Promise<T> {
    const { schema, ...config } = options
    const { data } = await this.request<T>(method, url, config)
    return schema === undefined ? data : (
        parseOrThrow(schema, data, `${method.toUpperCase()} ${url}`)
      )
  }

  /**
   * Template for the registry-refresh heartbeat shared by Classic's
   * `fetch()` and Home's `list()`: pause the auto-sync timer, run the
   * subclass work, log + swallow failures (a flaky heartbeat must not
   * crash the host — the next cycle retries), and always reschedule
   * the next sync.
   * @param work - Subclass closure that fetches and syncs the registry.
   * @returns The fetched entries, or an empty array on failure.
   */
  protected async runSyncCycle<T>(work: () => Promise<T[]>): Promise<T[]> {
    const epoch = this.#logOutEpoch
    this.clearSync()
    try {
      return await work()
    } catch (error) {
      this.logger.error('Failed to fetch devices:', error)
      return []
    } finally {
      this.#settleSyncCycle(epoch)
    }
  }

  /**
   * Run a best-effort GET/POST/… request and wrap the outcome in a
   * {@link Result}. The unwrapped response body is returned on success;
   * on failure the typed {@link ApiRequestError} variant lets callers
   * branch on the failure mode without catching opaque exceptions.
   *
   * See {@link requestData} for the throw-on-failure companion that
   * shares the same shape.
   * @param method - HTTP method (`get`, `post`, …).
   * @param url - Request URL relative to the API base.
   * @param options - Request config plus an optional `schema` peer key.
   * @returns `{ ok: true, value }` on success or `{ ok: false, error }`
   * with the classified failure mode.
   */
  protected async safeRequest<T>(
    method: string,
    url: string,
    options: Record<string, unknown> & { readonly schema?: z.ZodType<T> } = {},
  ): Promise<Result<T>> {
    try {
      return ok(await this.requestData<T>(method, url, options))
    } catch (error) {
      this.logger.error(
        `[${method.toUpperCase()} ${url}] request or validation failed:`,
        error,
      )
      return err(classifyError(error))
    }
  }

  /**
   * Try to reuse a persisted session without a full re-authentication:
   * skip when nothing is persisted, otherwise run one registry sync
   * and let {@link reuseSucceeded} judge the outcome. Returning
   * `false` falls through to a full {@link authenticate}.
   *
   * The probe is strictly non-destructive: `syncRegistry()` swallows
   * transient failures, which are indistinguishable here from a token
   * rejection, so clearing persisted state from this path would
   * destroy valid sessions on a boot-time network blip. Clearing is
   * owned by {@link clearPersistedSession}'s two callers only.
   * @returns `true` on reuse + registry populated; `false` otherwise.
   */
  protected async tryReuseSession(): Promise<boolean> {
    if (!this.hasPersistedSession()) {
      return false
    }
    await this.syncRegistry()
    return this.reuseSucceeded()
  }

  #armLoginBackoff(error: unknown): void {
    if (!(error instanceof AuthenticationError)) {
      // A transport failure is not a rejected login: the normal retry
      // paths own those, and pausing sign-ins would mask a mere blip.
      return
    }
    const backoffMs =
      error instanceof AuthenticationThrottledError ?
        LOGIN_BACKOFF_THROTTLE_MS
      : LOGIN_BACKOFF_FAILURE_MS
    this.#setLoginBackoffUntil(
      Temporal.Now.instant().epochMilliseconds + backoffMs,
    )
    this.logger.error(
      `Automatic sign-ins paused for ${String(Math.round(backoffMs / MS_PER_MINUTE))} minutes after a rejected login`,
    )
  }

  /**
   * Build the per-request resilience pipeline. Order matters — outer
   * policies see the attempt first: rate-limit guards the entry
   * point, auth-retry handles 401s after the inner retries give up,
   * and the optional transient retry (GET-only) is the innermost
   * wrapper around the raw `dispatch`.
   * @param context - Per-request correlation context used by the
   * transient-retry telemetry when it fires.
   * @param context.correlationId - UUID for cross-emission linkage.
   * @param context.method - HTTP method (uppercased) of the request.
   * @param context.url - URL of the request being dispatched.
   * @returns The composite policy ready to run the attempt.
   */
  #buildPolicy(context: {
    correlationId: string
    method: string
    url: string
  }): ResiliencePolicy {
    const policies: ResiliencePolicy[] = [
      this.#rateLimitPolicy,
      this.#authRetryPolicy,
    ]
    if (context.method === 'GET') {
      policies.push(
        new TransientRetryPolicy(
          {
            onRetry: (
              retryAttempt: number,
              error: unknown,
              delayMs: number,
            ): void => {
              this.logger.log(
                `Transient server error on ${context.url}: retry ${String(retryAttempt)} in ${String(delayMs)} ms`,
              )
              this.events.emitRetry({
                ...context,
                attempt: retryAttempt,
                delayMs,
                error,
              })
            },
          },
          this.abortSignal,
        ),
      )
    }
    return new CompositePolicy(policies)
  }

  #emitAuthenticationLostOnce(): void {
    if (this.#hasEmittedAuthenticationLost) {
      return
    }

    this.#hasEmittedAuthenticationLost = true
    this.events.emitAuthenticationLost()
  }

  // Post-`doAuthenticate` epilogue, split on the logOut epoch: a
  // logOut that landed while the sign-in round-trip was in flight
  // (e.g. the user signed out during a background resume) wins —
  // discard what the login just stored and stay signed out. Otherwise
  // clear the backoff gate and run the enforced post-auth sync.
  async #finishLogin(epoch: number): Promise<void> {
    if (this.#logOutEpoch !== epoch) {
      this.clearPersistedSession()
      this.username = ''
      this.password = ''
      return
    }
    this.#setLoginBackoffUntil(null)
    await this.syncRegistry()
  }

  // A loss is only a loss when there was something to restore — a
  // persisted session or persisted credentials. Probing an API that was
  // never configured must neither notify nor look like an expiry.
  #hasRecoverableState(): boolean {
    return (
      this.hasPersistedSession() || this.resolvePersistedCredentials() !== null
    )
  }

  // A corrupt persisted value reads as "no pause" — never lock the
  // user out on bad data.
  #isLoginBackedOff(): boolean {
    const raw = this.loginBackoffUntil
    if (raw === '') {
      return false
    }
    const until = Number(raw)
    return (
      Number.isFinite(until) && Temporal.Now.instant().epochMilliseconds < until
    )
  }

  // A live session marks any earlier loss episode as recovered —
  // announced once per episode, so the two events always alternate.
  #markLossRecovered(): void {
    if (!this.#hasEmittedAuthenticationLost) {
      return
    }

    this.#hasEmittedAuthenticationLost = false
    this.events.emitAuthenticationRestored()
  }

  async #runWithEvents<T>(
    context: { correlationId: string; method: string; url: string },
    runner: () => Promise<HttpResponse<T>>,
  ): Promise<HttpResponse<T>> {
    const startedAt = Date.now()
    this.events.emitStart(context)
    try {
      const response = await runner()
      this.events.emitComplete({
        ...context,
        durationMs: Date.now() - startedAt,
        status: response.status,
      })
      return response
    } catch (error) {
      this.events.emitError({
        ...context,
        durationMs: Date.now() - startedAt,
        error,
      })
      throw error
    }
  }

  // `''` is the cleared sentinel: the `@setting` accessor persists the
  // value and deletes the key outright when the host delegates `unset`.
  #setLoginBackoffUntil(until: number | null): void {
    this.loginBackoffUntil = until === null ? '' : String(until)
  }

  // Sync-cycle epilogue, split on the logOut epoch. A logOut that
  // landed while the cycle was in flight: its request completed with
  // the pre-sign-out session and repopulated the registry (and, on
  // Home, the user/context) — re-run the wipe so the sign-out sticks,
  // and leave the timer disarmed. Unauthenticated with nothing to
  // recover from (e.g. the settings page probing a never-configured
  // API) stays silent AND disarmed.
  #settleSyncCycle(epoch: number): void {
    if (this.#logOutEpoch !== epoch) {
      this.clearPersistedSession()
      this.clearRegistry()
      return
    }
    if (this.isAuthenticated()) {
      this.#markLossRecovered()
      this.syncManager.planNext()
      return
    }
    if (this.#hasRecoverableState()) {
      // Rescheduling would hammer the account with a doomed sign-in
      // every cycle: stay disarmed and surface the loss instead — a
      // successful authenticate() re-arms the sync through its
      // enforced post-auth registry sync.
      this.#emitAuthenticationLostOnce()
    }
  }

  private resolvePersistedCredentials(): LoginCredentials | null {
    const { password, username } = this
    if (username === '' || password === '') {
      return null
    }
    return { password, username }
  }
}
