import { randomUUID } from 'node:crypto'

import type { ClassicLoginCredentials } from '../types/index.ts'
import { setting } from '../decorators/index.ts'
import { AuthenticationError } from '../errors/index.ts'
import {
  type HttpClientConfig,
  type HttpResponse,
  HttpClient,
  isHttpError,
} from '../http/index.ts'
import {
  APICallRequestData,
  APICallResponseData,
  createAPICallErrorData,
  RequestLifecycleEmitter,
} from '../observability/index.ts'
import {
  DEFAULT_TRANSIENT_RETRY_OPTIONS,
  isTransientServerError,
  RateLimitError,
  RateLimitGate,
  RetryGuard,
  withRetryBackoff,
} from '../resilience/index.ts'
import type {
  BaseAPIConfig,
  Logger,
  SettingManager,
  SyncCallback,
} from './interfaces.ts'
import { SyncManager } from './sync-manager.ts'

const HTTP_STATUS_UNAUTHORIZED = 401
const HTTP_STATUS_TOO_MANY_REQUESTS = 429

/**
 * Narrow any error the HTTP client can surface into either an
 * {@link AuthenticationError} (for `401 Unauthorized`) or the error
 * unchanged. Subclass `doAuthenticate` implementations call this
 * helper to normalize transport-level rejections into the shared
 * domain error type — callers of {@link BaseAPI.authenticate} then
 * get a stable `AuthenticationError` regardless of whether the
 * underlying flow was cookie-based (Classic) or bearer-token (Home).
 * @param error - The error to inspect.
 * @returns `AuthenticationError` if a 401 HttpError; `error` otherwise.
 */
export const normalizeUnauthorized = (error: unknown): unknown =>
  isHttpError(error) && error.response.status === HTTP_STATUS_UNAUTHORIZED ?
    new AuthenticationError('MELCloud rejected the credentials', {
      cause: error,
    })
  : error

/** Options for the {@link BaseAPI} constructor beyond the base config. */
interface BaseAPIConstructorOptions {
  httpConfig: HttpClientConfig
  rateLimitHours: number
  retryDelay: number
  httpClient?: HttpClient
  syncCallback: () => Promise<unknown>
}

/**
 * Shared infrastructure for MELCloud API clients.
 *
 * Extracts the common fields, lifecycle management (sync, rate-limit,
 * retry guard, dispose), and credential handling that both ClassicAPI
 * and HomeAPI duplicate.
 */
export abstract class BaseAPI implements Disposable {
  public readonly logger: Logger

  public readonly onSync?: SyncCallback

  public readonly settingManager?: SettingManager

  public get isRateLimited(): boolean {
    return this.rateLimitGate.isPaused
  }

  protected readonly abortSignal?: AbortSignal

  protected readonly api: HttpClient

  protected readonly events: RequestLifecycleEmitter

  protected readonly rateLimitGate: RateLimitGate

  protected readonly retryGuard: RetryGuard

  @setting
  protected accessor expiry = ''

  @setting
  protected accessor password = ''

  @setting
  protected accessor username = ''

  protected get syncManager(): SyncManager {
    return this.#syncManager
  }

  /*
   * Single in-flight refresh handle. Set when the first `ensureSession`
   * call detects an expired session, cleared when the refresh resolves
   * (success or failure). Subsequent concurrent callers await the same
   * promise instead of each triggering their own round-trip — prevents
   * the thundering-herd pattern on token expiry.
   */
  #refreshPromise: Promise<void> | null = null

  readonly #syncManager: SyncManager

  protected constructor(
    {
      abortSignal,
      autoSyncInterval,
      events,
      logger = console,
      onSync,
      settingManager,
    }: BaseAPIConfig,
    {
      httpClient,
      httpConfig,
      rateLimitHours,
      retryDelay,
      syncCallback,
    }: BaseAPIConstructorOptions,
  ) {
    this.abortSignal = abortSignal
    this.logger = logger
    this.onSync = onSync
    this.settingManager = settingManager
    this.events = new RequestLifecycleEmitter(events, logger)
    this.rateLimitGate = new RateLimitGate({ hours: rateLimitHours })
    this.retryGuard = new RetryGuard(retryDelay)
    this.api = httpClient ?? new HttpClient(httpConfig)
    this.#syncManager = new SyncManager(syncCallback, logger, autoSyncInterval)
  }

  protected abstract doAuthenticate(
    credentials: ClassicLoginCredentials,
  ): Promise<void>

  protected abstract getAuthHeaders(): Record<string, string>

  public abstract isAuthenticated(): boolean

  /**
   * Subclass hook: whether the current persisted session needs to be
   * refreshed before the next request goes out. Implementations
   * typically check `isSessionExpired(this.expiry, aheadMs)` with a
   * non-zero `aheadMs` so refresh happens **before** the real expiry
   * tick (pre-emptive renewal), keeping the re-auth latency off the
   * request's critical path.
   *
   * Used exclusively by the template {@link ensureSession}; not meant
   * to be called by subclass code directly.
   */
  protected abstract needsSessionRefresh(): boolean

  /**
   * Subclass hook: perform the actual session refresh. Called by the
   * template {@link ensureSession} when {@link needsSessionRefresh}
   * returns `true`. Implementations decide the best path — a token
   * refresh (cheap) if available, otherwise a full {@link resumeSession}
   * (re-auth from persisted credentials).
   *
   * Errors inside this hook propagate — the template does not swallow
   * them; the triggering request will fail and the caller decides how
   * to react. Use {@link resumeSession}'s own log + swallow semantics
   * if best-effort behaviour is required.
   */
  protected abstract performSessionRefresh(): Promise<void>

  protected abstract retryAuth<T>(
    method: string,
    url: string,
    config: Record<string, unknown>,
  ): Promise<HttpResponse<T> | null>

  protected abstract syncRegistry(): Promise<void>

  /**
   * Subclass hook: attempt to reuse an existing persisted session
   * without going through a full re-authentication. Implementations
   * must return `true` ONLY when the session has been **verified
   * against the server** (a single credentialed request that also
   * populates the device registry is the canonical shape). A `true`
   * return therefore carries two guarantees: the instance is
   * authenticated, and its registry reflects server state.
   *
   * Returning `false` is the contract for "no usable session" — the
   * template `initialize()` will then fall through to a full
   * {@link authenticate} flow (which has its own registry sync
   * guarantee).
   * @returns `true` when a persisted session has been reused and the
   * registry is populated; `false` to fall through to authenticate.
   */
  protected abstract tryReuseSession(): Promise<boolean>

  /**
   * Sign in with explicit credentials.
   *
   * Contract: throws an {@link AuthenticationError} if MELCloud
   * rejects the credentials — whatever the underlying transport
   * (Classic `ClientLogin3` returning `LoginData: null`, Home BFF
   * returning 401, etc.). A successful return guarantees the
   * registry reflects server state — the post-auth sync is
   * mandatory and enforced here so subclasses cannot forget it
   * (regression guard, see OlivierZal/com.melcloud#1281).
   *
   * Use {@link resumeSession} instead when you want a best-effort
   * restore from persisted credentials that logs + swallows errors.
   * @param credentials - Explicit username/password.
   * @throws {AuthenticationError} when credentials are rejected.
   */
  public async authenticate(
    credentials: ClassicLoginCredentials,
  ): Promise<void> {
    this.applyCredentials(credentials.username, credentials.password)
    await this.doAuthenticate(credentials)
    await this.syncRegistry()
  }

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
   * 1. {@link tryReuseSession} — if the subclass can reuse a
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
    await this.resumeSession()
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

  public [Symbol.dispose](): void {
    this.#syncManager[Symbol.dispose]()
    this.retryGuard[Symbol.dispose]()
  }

  public setSyncInterval(minutes: number | null): void {
    this.#syncManager.setInterval(minutes)
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
        ...(typeof configHeaders === 'object' ? configHeaders : {}),
        ...this.getAuthHeaders(),
      },
      method,
      ...(this.abortSignal === undefined ? {} : { signal: this.abortSignal }),
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
    this.throwIfRateLimited()
    const context = {
      correlationId: randomUUID(),
      method: method.toUpperCase(),
      url,
    }
    const attempt = this.makeRequestAttempt<T>(method, url, config)
    const runner =
      method.toUpperCase() === 'GET' ?
        async (): Promise<HttpResponse<T>> =>
          withRetryBackoff(attempt, {
            ...DEFAULT_TRANSIENT_RETRY_OPTIONS,
            isRetryable: isTransientServerError,
            onRetry: (retryAttempt, error, delayMs) => {
              this.logger.log(
                `Transient server error on ${url}: retry ${String(retryAttempt)} in ${String(delayMs)} ms`,
              )
              this.events.emitRetry({
                ...context,
                attempt: retryAttempt,
                delayMs,
                error,
              })
            },
          })
      : attempt
    return this.runWithEvents(context, runner)
  }

  private makeRequestAttempt<T>(
    method: string,
    url: string,
    config: Record<string, unknown>,
  ): () => Promise<HttpResponse<T>> {
    return async () => {
      try {
        return await this.dispatch<T>(method, url, config)
      } catch (error) {
        this.logError(error)
        this.recordRateLimitIfApplicable(error)
        if (this.shouldRetryAuth(error)) {
          const retried = await this.retryAuth<T>(method, url, config)
          if (retried !== null) {
            return retried
          }
        }
        throw error
      }
    }
  }

  private recordRateLimitIfApplicable(error: unknown): void {
    if (!isHttpError(error)) {
      return
    }
    if (error.response.status !== HTTP_STATUS_TOO_MANY_REQUESTS) {
      return
    }
    this.rateLimitGate.recordAndLog(
      this.logger,
      error.response.headers['retry-after'],
    )
  }

  private resolvePersistedCredentials(): ClassicLoginCredentials | null {
    const { password, username } = this
    if (!username || !password) {
      return null
    }
    return { password, username }
  }

  private async runWithEvents<T>(
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

  private shouldRetryAuth(error: unknown): boolean {
    if (!isHttpError(error)) {
      return false
    }
    if (error.response.status !== HTTP_STATUS_UNAUTHORIZED) {
      return false
    }
    return this.retryGuard.tryConsume()
  }

  private throwIfRateLimited(): void {
    if (this.rateLimitGate.isPaused) {
      throw new RateLimitError(
        `API requests are on hold for ${this.rateLimitGate.formatRemaining()}`,
        { retryAfter: this.rateLimitGate.remaining },
      )
    }
  }
}
