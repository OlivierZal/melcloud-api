import { randomUUID } from 'node:crypto'

import type { z } from 'zod'

import { setting } from '../decorators/index.ts'
import { AuthenticationError, RateLimitError } from '../errors/index.ts'
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
 * Order matters: domain errors (`AuthenticationError`, `RateLimitError`)
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
      retryAfterMs: error.retryAfter?.toMillis() ?? null,
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
  isHttpError(error) && error.response.status === HttpStatus.Unauthorized ?
    new AuthenticationError('MELCloud rejected the credentials', {
      cause: error,
    })
  : error

const DEFAULT_TIMEOUT_MS = 30_000

// Cool-down between consecutive auth-retry consumptions on the same
// RetryGuard. Hardcoded because no caller has ever needed to tune it
// — every Classic + Home flow uses the same 1 s value, and adjusting
// it is more likely to mask bugs than reflect a real product need.
const DEFAULT_AUTH_RETRY_COOLDOWN_MS = 1000

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
  /** Sliding-window length the rate-limit gate observes. */
  rateLimitHours: number
  /** Sync runner the auto-timer drives. */
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

  public readonly settingManager?: SettingManager

  public get isRateLimited(): boolean {
    return this.rateLimitGate.isPaused
  }

  protected readonly abortSignal?: AbortSignal

  protected readonly api: HttpClient

  protected readonly events: LifecycleEmitter

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

  // Policy instances are created once in the constructor and reused
  // for every request. Stateless w.r.t. individual calls — the shared
  // state (rate-limit gate, retry guard) lives in the policy's
  // injected dependencies, not in the policy itself.
  readonly #authRetryPolicy: AuthRetryPolicy

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
      rateLimitHours,
      syncCallback,
    }: BaseAPIConstructorOptions,
  ) {
    this.abortSignal = abortSignal
    this.logger = logger
    this.settingManager = settingManager
    this.events = new LifecycleEmitter(events, logger)
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

  protected abstract doAuthenticate(
    credentials: LoginCredentials,
  ): Promise<void>

  protected abstract getAuthHeaders(): Record<string, string>

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

  protected abstract syncRegistry(): Promise<void>

  /**
   * Subclass hook: try to reuse a persisted session without a full
   * re-authentication. A `true` return carries two guarantees: the
   * instance is authenticated, and the registry has been verified
   * against the server (typically via a credentialed request that
   * also populates it). Returning `false` falls through to a full
   * {@link authenticate}.
   * @returns `true` on reuse + registry populated; `false` otherwise.
   */
  protected abstract tryReuseSession(): Promise<boolean>

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
   * Notify any registered `events.onSyncComplete` observer that a
   * sync just landed. Routed through the lifecycle emitter so a
   * misbehaving callback cannot break the caller. Invoked by the
   * `@syncDevices` decorator after each decorated mutation.
   * @param args - `SyncCallback`-shaped payload (`type`, `ids`).
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

  public setSyncInterval(minutes: number | false): void {
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

  private resolvePersistedCredentials(): LoginCredentials | null {
    const { password, username } = this
    if (!username || !password) {
      return null
    }
    return { password, username }
  }
}
