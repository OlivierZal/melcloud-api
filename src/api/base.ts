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

/*
 * Wrap 401 responses from the HTTP client into a typed
 * {@link AuthenticationError} (preserving the original via `cause`) so
 * credential rejections have a stable, semantic error type. Errors from
 * other sources (fetch-based OIDC flow, network issues, non-401 statuses)
 * are returned unchanged and keep their original type.
 */
const toAuthFailure = (error: unknown): unknown =>
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

  protected abstract ensureSession(): Promise<void>

  protected abstract getAuthHeaders(): Record<string, string>

  public abstract isAuthenticated(): boolean

  protected abstract retryAuth<T>(
    method: string,
    url: string,
    config: Record<string, unknown>,
  ): Promise<HttpResponse<T> | null>

  protected abstract syncRegistry(): Promise<void>

  /**
   * Authenticate against MELCloud and populate the device registry.
   *
   * Contract: a successful return guarantees the registry reflects the
   * server state. The post-auth registry sync is mandatory and enforced
   * here so subclasses cannot forget it (regression-prone, see
   * OlivierZal/com.melcloud#1281).
   *
   * Credential resolution: falls back to persisted `username`/`password`
   * when `data` is omitted. Missing credentials is a no-op — callers
   * should check {@link isAuthenticated} to detect this case.
   *
   * Error handling: explicit credentials surface failures to the caller;
   * persisted-credential auto-login failures are logged and swallowed
   * so startup doesn't crash when the saved session is stale. Only 401
   * HttpErrors are wrapped as {@link AuthenticationError}; other failures
   * propagate with their original type.
   * @param data - Optional credentials; falls back to persisted values.
   */
  public async authenticate(data?: ClassicLoginCredentials): Promise<void> {
    const credentials = this.resolveCredentials(data)
    if (credentials === null) {
      return
    }
    if (!(await this.runDoAuthenticate(credentials, data !== undefined))) {
      return
    }
    await this.syncRegistry()
  }

  public clearSync(): void {
    this.#syncManager.clear()
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

  private resolveCredentials(
    data: ClassicLoginCredentials | undefined,
  ): ClassicLoginCredentials | null {
    const username = data?.username ?? this.username
    const password = data?.password ?? this.password
    if (!username || !password) {
      return null
    }
    return { password, username }
  }

  private async runDoAuthenticate(
    credentials: ClassicLoginCredentials,
    hasExplicitCredentials: boolean,
  ): Promise<boolean> {
    try {
      await this.doAuthenticate(credentials)
      return true
    } catch (error) {
      const failure = toAuthFailure(error)
      if (hasExplicitCredentials) {
        throw failure
      }
      this.logger.error('Authentication failed:', failure)
      return false
    }
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
