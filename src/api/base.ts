import { randomUUID } from 'node:crypto'

import axios, {
  type AxiosInstance,
  type AxiosResponse,
  HttpStatusCode,
} from 'axios'

import type { LoginCredentials } from '../types/index.ts'
import { setting } from '../decorators/index.ts'
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

/** Options for the {@link BaseAPI} constructor beyond the base config. */
interface BaseAPIConstructorOptions {
  axiosConfig: {
    baseURL: string
    timeout: number
    headers?: Record<string, string>
  }
  rateLimitHours: number
  retryDelay: number
  axiosInstance?: AxiosInstance
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

  protected readonly api: AxiosInstance

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
      axiosConfig,
      axiosInstance,
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
    this.api = axiosInstance ?? axios.create(axiosConfig)
    this.#syncManager = new SyncManager(syncCallback, logger, autoSyncInterval)
  }

  public abstract authenticate(data?: LoginCredentials): Promise<boolean>

  protected abstract ensureSession(): Promise<void>

  protected abstract getAuthHeaders(): Record<string, string>

  protected abstract retryAuth<T>(
    method: string,
    url: string,
    config: Record<string, unknown>,
  ): Promise<AxiosResponse<T> | null>

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
  ): Promise<AxiosResponse<T>> {
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
    this.logger.log(String(new APICallResponseData(response)))
    return response
  }

  protected logError(error: unknown): void {
    if (axios.isAxiosError(error)) {
      this.logger.error(String(createAPICallErrorData(error)))
    }
  }

  protected async request<T = unknown>(
    method: string,
    url: string,
    config: Record<string, unknown> = {},
  ): Promise<AxiosResponse<T>> {
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
        async (): Promise<AxiosResponse<T>> =>
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
  ): () => Promise<AxiosResponse<T>> {
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
    if (!axios.isAxiosError(error)) {
      return
    }
    if (error.response?.status !== HttpStatusCode.TooManyRequests) {
      return
    }
    this.rateLimitGate.recordAndLog(
      this.logger,
      (error.response.headers as Record<string, unknown>)['retry-after'],
    )
  }

  private async runWithEvents<T>(
    context: { correlationId: string; method: string; url: string },
    runner: () => Promise<AxiosResponse<T>>,
  ): Promise<AxiosResponse<T>> {
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
    if (!axios.isAxiosError(error)) {
      return false
    }
    if (error.response?.status !== HttpStatusCode.Unauthorized) {
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
