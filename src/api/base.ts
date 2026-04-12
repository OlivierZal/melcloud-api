import axios, { type AxiosInstance } from 'axios'

import type { LoginCredentials } from '../types/index.ts'
import { setting } from '../decorators/index.ts'
import {
  createAPICallErrorData,
  RequestLifecycleEmitter,
} from '../observability/index.ts'
import { RateLimitGate, RetryGuard } from '../resilience/index.ts'
import type {
  BaseAPIConfig,
  Logger,
  OnSyncFunction,
  SettingManager,
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

  public readonly onSync?: OnSyncFunction

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

  protected logError(error: unknown): void {
    if (axios.isAxiosError(error)) {
      this.logger.error(String(createAPICallErrorData(error)))
    }
  }
}
