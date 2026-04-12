import { randomUUID } from 'node:crypto'

import axios, { type AxiosResponse, HttpStatusCode } from 'axios'

import type {
  HomeAtaValues,
  HomeBuilding,
  HomeContext,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
  HomeUser,
  LoginCredentials,
} from '../types/index.ts'
import { HomeDeviceType } from '../constants.ts'
import { authenticate, setting, syncDevices } from '../decorators/index.ts'
import { HomeRegistry } from '../models/home-registry.ts'
import {
  APICallRequestData,
  APICallResponseData,
} from '../observability/index.ts'
import {
  DEFAULT_TRANSIENT_RETRY_OPTIONS,
  isSessionExpired,
  isTransientServerError,
  RateLimitError,
  withRetryBackoff,
} from '../resilience/index.ts'
import type { HomeAPIConfig, HomeAPI as HomeAPIContract } from './interfaces.ts'
import { BaseAPI } from './base.ts'
import {
  type TokenResponse,
  performTokenAuth,
  refreshAccessToken,
} from './token-auth.ts'

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const API_BASE_URL = 'https://mobile.bff.melcloudhome.com'
const ATA_UNIT_PATH = '/monitor/ataunit'
const CONTEXT_PATH = '/context'
const DEFAULT_RATE_LIMIT_FALLBACK_HOURS = 2
const DEFAULT_TIMEOUT_MS = 30_000
const ENERGY_PATH = '/monitor/telemetry/energy'
const MILLISECONDS_IN_SECOND = 1000
const REPORT_PATH = '/report/trendsummary'
const RETRY_DELAY = 1000
const SIGNAL_PATH = '/monitor/telemetry/actual'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const parseUser = (data: HomeContext): HomeUser => ({
  email: data.email,
  firstName: data.firstname,
  lastName: data.lastname,
  sub: data.id,
})

/**
 * MELCloud Home API client using the mobile BFF at
 * `mobile.bff.melcloudhome.com` with Bearer-token authentication.
 *
 * Authenticates via a headless OIDC flow:
 *   PAR → IdentityServer → AWS Cognito → token exchange.
 *
 * Access and refresh tokens are persisted through the SettingManager
 * (analogous to the Classic API's `contextKey`).
 *
 * Uses a private constructor — create instances via {@link HomeAPI.create}.
 */
export class HomeAPI extends BaseAPI implements HomeAPIContract {
  public get context(): HomeContext | null {
    return this.#context
  }

  public get registry(): HomeRegistry {
    return this.#registry
  }

  public get user(): HomeUser | null {
    return this.#user
  }

  #context: HomeContext | null = null

  readonly #registry = new HomeRegistry()

  #user: HomeUser | null = null

  @setting
  private accessor accessToken = ''

  @setting
  private accessor refreshToken = ''

  private constructor(config: HomeAPIConfig = {}) {
    const {
      autoSyncInterval = 1,
      baseURL = API_BASE_URL,
      password,
      requestTimeout = DEFAULT_TIMEOUT_MS,
      username,
    } = config
    super(
      { ...config, autoSyncInterval },
      {
        axiosConfig: { baseURL, timeout: requestTimeout },
        rateLimitHours: DEFAULT_RATE_LIMIT_FALLBACK_HOURS,
        retryDelay: RETRY_DELAY,
        syncCallback: async () => this.list(),
      },
    )
    this.applyCredentials(username, password)
  }

  /**
   * Create and initialize a MELCloud Home API instance.
   *
   * If the SettingManager holds a persisted session (tokens + unexpired
   * expiry), the instance reuses it via `getUser()` and skips re-login.
   * If the access token is expired but a refresh token is available,
   * a token refresh is attempted. Otherwise, falls back to a full
   * `authenticate()` flow.
   * @param config - Optional configuration.
   * @returns The initialized HomeAPI instance.
   */
  public static async create(config?: HomeAPIConfig): Promise<HomeAPI> {
    const api = new HomeAPI(config)
    if (api.#hasPersistedSession()) {
      if ((await api.getUser()) !== null) {
        return api
      }
      api.#clearPersistedSession()
    }
    await api.authenticate()
    return api
  }

  @authenticate
  public async authenticate(data?: LoginCredentials): Promise<boolean> {
    /* v8 ignore next -- @authenticate guarantees data is always provided */
    const { password, username } = data ?? { password: '', username: '' }
    this.#clearPersistedSession()
    const tokens = await performTokenAuth({
      credentials: { password, username },
      ...(this.abortSignal === undefined ?
        {}
      : { abortSignal: this.abortSignal }),
    })
    this.#storeTokens(tokens)
    await this.#fetchContext()
    ;({ password: this.password, username: this.username } = {
      password,
      username,
    })
    return this.#user !== null
  }

  public async getEnergy(
    id: string,
    params: { from: string; interval: string; to: string },
  ): Promise<HomeEnergyData | null> {
    return this.#safeRequest<HomeEnergyData>(`${ENERGY_PATH}/${id}`, {
      params: {
        ...params,
        measure: 'cumulative_energy_consumed_since_last_upload',
      },
    })
  }

  public async getErrorLog(id: string): Promise<HomeErrorLogEntry[]> {
    return (
      (await this.#safeRequest<HomeErrorLogEntry[]>(
        `${ATA_UNIT_PATH}/${id}/errorlog`,
      )) ?? []
    )
  }

  public async getSignal(
    id: string,
    params: { from: string; to: string },
  ): Promise<HomeEnergyData | null> {
    return this.#safeRequest<HomeEnergyData>(`${SIGNAL_PATH}/${id}`, {
      params: { ...params, measure: 'rssi' },
    })
  }

  public async getTemperatures(
    id: string,
    params: { from: string; period: string; to: string },
  ): Promise<HomeReportData[] | null> {
    return this.#safeRequest<HomeReportData[]>(REPORT_PATH, {
      params: { ...params, unitId: id },
    })
  }

  /**
   * Validate the current session by fetching the user context.
   * Returns `null` if the request fails (401, network error, etc.)
   * and clears the stored user state.
   * @returns The user or `null`.
   */
  public async getUser(): Promise<HomeUser | null> {
    try {
      await this.#fetchContext()
      return this.#user
    } catch {
      this.#user = null
      return null
    }
  }

  public isAuthenticated(): boolean {
    return this.#user !== null
  }

  /**
   * Fetch all buildings (owned + guest), sync the device registry,
   * and schedule the next auto-sync.
   * @returns All buildings or an empty array on failure.
   */
  @syncDevices()
  public async list(): Promise<HomeBuilding[]> {
    this.clearSync()
    try {
      const data = await this.#fetchContext()
      const buildings = [...data.buildings, ...data.guestBuildings]
      this.#registry.sync(
        buildings.flatMap(({ airToAirUnits, airToWaterUnits }) => [
          ...airToAirUnits.map((device) => ({
            device,
            type: HomeDeviceType.Ata,
          })),
          ...airToWaterUnits.map((device) => ({
            device,
            type: HomeDeviceType.Atw,
          })),
        ]),
      )
      return buildings
    } catch {
      return []
    } finally {
      this.syncManager.planNext()
    }
  }

  public async setValues(id: string, values: HomeAtaValues): Promise<boolean> {
    try {
      await this.#request('put', `${ATA_UNIT_PATH}/${id}`, { data: values })
      await this.list()
      return true
    } catch {
      return false
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Private — credentials & session                                 */
  /* ---------------------------------------------------------------- */

  #clearPersistedSession(): void {
    this.#user = null
    this.accessToken = ''
    this.refreshToken = ''
    this.expiry = ''
  }

  #hasPersistedSession(): boolean {
    return (
      (this.accessToken !== '' &&
        this.expiry !== '' &&
        !isSessionExpired(this.expiry)) ||
      this.refreshToken !== ''
    )
  }

  #syncContext(data: HomeContext): void {
    this.#context = data
    this.#user = parseUser(data)
  }

  /**
   * Fetch the user context from the BFF and update local state.
   * Shared by `getUser()` and `list()`.
   * @returns The fetched home context.
   */
  async #fetchContext(): Promise<HomeContext> {
    const { data } = await this.#request<HomeContext>('get', CONTEXT_PATH)
    this.#syncContext(data)
    return data
  }

  /* ---------------------------------------------------------------- */
  /*  Private — token management                                      */
  /* ---------------------------------------------------------------- */

  #storeTokens(data: TokenResponse): void {
    const { access_token, expires_in, refresh_token } = data
    this.accessToken = access_token
    if (refresh_token !== undefined && refresh_token !== '') {
      this.refreshToken = refresh_token
    }
    this.expiry = new Date(
      Date.now() + expires_in * MILLISECONDS_IN_SECOND,
    ).toISOString()
  }

  /**
   * Use the refresh token to obtain a fresh access token.
   * @returns Whether the refresh succeeded.
   */
  async #refreshAccessToken(): Promise<boolean> {
    const tokens = await refreshAccessToken({
      refreshToken: this.refreshToken,
      ...(this.abortSignal === undefined ?
        {}
      : { abortSignal: this.abortSignal }),
    })
    if (tokens === null) {
      return false
    }
    this.#storeTokens(tokens)
    return true
  }

  /* ---------------------------------------------------------------- */
  /*  Private — API request pipeline                                  */
  /* ---------------------------------------------------------------- */

  /**
   * Send a request through the API axios instance, injecting the
   * Bearer token. Symmetric logging mirrors the Classic API's
   * interceptor pattern.
   * @param method - HTTP method (GET, POST, etc.).
   * @param url - Request URL path.
   * @param root0 - Request configuration.
   * @param root0.headers - Optional extra headers.
   * @returns The Axios response.
   */
  async #dispatch<T = unknown>(
    method: string,
    url: string,
    {
      headers: configHeaders,
      ...config
    }: {
      [key: string]: unknown
      headers?: Record<string, string>
    },
  ): Promise<AxiosResponse<T>> {
    const requestConfig = {
      ...config,
      headers: {
        ...configHeaders,
        ...(this.accessToken === '' ?
          {}
        : { Authorization: `Bearer ${this.accessToken}` }),
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

  /**
   * Proactive session check: refresh the access token if expired,
   * falling back to a full re-authentication when refresh fails.
   */
  async #ensureSession(): Promise<void> {
    if (!isSessionExpired(this.expiry)) {
      return
    }
    if (this.refreshToken !== '' && (await this.#refreshAccessToken())) {
      return
    }
    await this.authenticate()
  }

  #makeRequestAttempt<T>(
    method: string,
    url: string,
    config: { [key: string]: unknown; headers?: Record<string, string> },
  ): () => Promise<AxiosResponse<T>> {
    return async () => {
      try {
        return await this.#dispatch<T>(method, url, config)
      } catch (error) {
        this.logError(error)
        this.#recordRateLimitIfApplicable(error)
        if (this.#shouldRetryAuth(error)) {
          const retried = await this.#retryWithReauth<T>(method, url, config)
          if (retried !== null) {
            return retried
          }
        }
        throw error
      }
    }
  }

  #recordRateLimitIfApplicable(error: unknown): void {
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

  async #request<T = unknown>(
    method: string,
    url: string,
    config: {
      [key: string]: unknown
      headers?: Record<string, string>
    } = {},
  ): Promise<AxiosResponse<T>> {
    await this.#ensureSession()
    this.#throwIfRateLimited()
    const context = {
      correlationId: randomUUID(),
      method: method.toUpperCase(),
      url,
    }
    const attempt = this.#makeRequestAttempt<T>(method, url, config)
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
    return this.#runWithEvents(context, runner)
  }

  async #retryWithReauth<T>(
    method: string,
    url: string,
    config: { [key: string]: unknown; headers?: Record<string, string> },
  ): Promise<AxiosResponse<T> | null> {
    if (this.refreshToken !== '' && (await this.#refreshAccessToken())) {
      return this.#dispatch<T>(method, url, config)
    }
    this.#clearPersistedSession()
    if (await this.authenticate()) {
      return this.#dispatch<T>(method, url, config)
    }
    return null
  }

  async #runWithEvents<T>(
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

  async #safeRequest<T>(
    url: string,
    config?: Record<string, unknown>,
  ): Promise<T | null> {
    try {
      const { data } = await this.#request<T>('get', url, config)
      return data
    } catch {
      return null
    }
  }

  #shouldRetryAuth(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false
    }
    if (error.response?.status !== HttpStatusCode.Unauthorized) {
      return false
    }
    return this.retryGuard.tryConsume()
  }

  #throwIfRateLimited(): void {
    if (!this.rateLimitGate.isPaused) {
      return
    }
    throw new RateLimitError(
      `API requests are on hold for ${this.rateLimitGate.formatRemaining()} (upstream rate-limited)`,
      { retryAfter: this.rateLimitGate.remaining },
    )
  }
}
