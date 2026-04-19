import type { z } from 'zod'

import type { HttpResponse } from '../http/index.ts'
import type {
  ClassicLoginCredentials,
  HomeAtaValues,
  HomeBuilding,
  HomeContext,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
  HomeUser,
} from '../types/index.ts'
import { HomeDeviceType } from '../constants.ts'
import { setting, syncDevices } from '../decorators/index.ts'
import { HomeRegistry } from '../entities/home-registry.ts'
import { isSessionExpired } from '../resilience/index.ts'
import {
  HomeContextSchema,
  HomeEnergyDataSchema,
  HomeErrorLogEntryListSchema,
  HomeReportDataSchema,
  parseOrThrow,
} from '../validation/index.ts'
import type {
  HomeAPIConfig,
  HomeAPI as HomeAPIContract,
} from './home-interfaces.ts'
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
  /**
   * Latest `/context` payload from the BFF, or `null` before the
   * first successful call. Populated by {@link authenticate} and
   * {@link list}; cleared on session invalidation.
   * @returns The cached context, or `null`.
   */
  public get context(): HomeContext | null {
    return this.#context
  }

  /**
   * In-memory device registry populated by {@link list}.
   * @returns The registry instance.
   */
  public get registry(): HomeRegistry {
    return this.#registry
  }

  /**
   * Currently authenticated user, or `null` when unauthenticated.
   * Derived from the most recent `/context` response.
   * @returns The user, or `null`.
   */
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
      httpClient,
      password,
      requestTimeout = DEFAULT_TIMEOUT_MS,
      username,
    } = config
    super(
      { ...config, autoSyncInterval },
      {
        httpClient,
        httpConfig: { baseURL, timeout: requestTimeout },
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
   *
   * In every successful branch the registry is populated before return
   * — `authenticate()` does so via its template method, and the
   * reuse-session branch calls `list()` (which hydrates both
   * `context`/`user` and the device registry in a single /context
   * request). A successful return therefore guarantees a non-empty
   * registry (regression guard for the #1281-class of bug, applied to
   * the persisted-session path as well as the fresh-login path).
   * @param config - Optional configuration.
   * @returns The initialized HomeAPI instance.
   */
  public static async create(config?: HomeAPIConfig): Promise<HomeAPI> {
    const api = new HomeAPI(config)
    if (api.#hasPersistedSession()) {
      await api.list()
      if (api.context !== null) {
        return api
      }
      api.#clearPersistedSession()
    }
    await api.authenticate()
    return api
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

  /**
   * Fetch cumulative-energy telemetry for an ATA unit. The returned
   * payload is Zod-validated against `HomeEnergyDataSchema`; any
   * failure (network, 4xx, shape mismatch) resolves to `null` so the
   * caller can treat missing data as a no-op rather than branching on
   * errors.
   * @param id - Device id.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.interval - Aggregation interval (e.g. `PT1H`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns The telemetry bundle, or `null` on any failure.
   */
  public async getEnergy(
    id: string,
    params: { from: string; interval: string; to: string },
  ): Promise<HomeEnergyData | null> {
    return this.#safeRequest({
      config: {
        params: {
          ...params,
          measure: 'cumulative_energy_consumed_since_last_upload',
        },
      },
      context: 'BFF /monitor/telemetry/energy',
      schema: HomeEnergyDataSchema,
      url: `${ENERGY_PATH}/${id}`,
    })
  }

  /**
   * Fetch the error-log entries for an ATA unit. Unlike the other
   * telemetry getters, a failure resolves to an empty array rather
   * than `null`, matching how consumer code typically iterates the
   * result.
   * @param id - Device id.
   * @returns The entries, or `[]` on any failure.
   */
  public async getErrorLog(id: string): Promise<HomeErrorLogEntry[]> {
    return (
      (await this.#safeRequest({
        context: 'BFF /monitor/ataunit/:id/errorlog',
        schema: HomeErrorLogEntryListSchema,
        url: `${ATA_UNIT_PATH}/${id}/errorlog`,
      })) ?? []
    )
  }

  /**
   * Fetch RSSI telemetry for an ATA unit. Same silent-fail semantics
   * as {@link getEnergy} — resolves to `null` on any failure.
   * @param id - Device id.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns The telemetry bundle, or `null` on any failure.
   */
  public async getSignal(
    id: string,
    params: { from: string; to: string },
  ): Promise<HomeEnergyData | null> {
    return this.#safeRequest({
      config: { params: { ...params, measure: 'rssi' } },
      context: 'BFF /monitor/telemetry/actual',
      schema: HomeEnergyDataSchema,
      url: `${SIGNAL_PATH}/${id}`,
    })
  }

  /**
   * Fetch a trend-summary report (temperatures, etc.) for an ATA
   * unit. Silent-fail: resolves to `null` on any failure.
   * @param id - Device id.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.period - Aggregation period (e.g. `hour`, `day`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns The report datasets, or `null` on any failure.
   */
  public async getTemperatures(
    id: string,
    params: { from: string; period: string; to: string },
  ): Promise<HomeReportData[] | null> {
    return this.#safeRequest({
      config: { params: { ...params, unitId: id } },
      context: 'BFF /report/trendsummary',
      schema: HomeReportDataSchema.array(),
      url: REPORT_PATH,
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

  public override async syncRegistry(): Promise<void> {
    await this.list()
  }

  /**
   * Send an ATA-unit setpoint update to the BFF. On success, re-sync
   * the registry so it reflects the server-side effect of the write
   * (the PUT response itself does not echo device fields). On failure,
   * skip the sync — the server state is presumed unchanged, so a
   * re-fetch would be wasted work.
   *
   * Swallows PUT errors — the return flag signals success/failure so
   * integrating hosts (e.g. Homey drivers) can treat a transient
   * failure as a no-op and retry on the next sync. Sync errors after a
   * successful PUT are logged and swallowed: they must not flip the
   * return value to `false`, since the mutation did land on the server.
   * @param id - Target device id.
   * @param values - Partial setpoint payload.
   * @returns `true` when the update succeeded, `false` otherwise.
   */
  public async updateValues(
    id: string,
    values: HomeAtaValues,
  ): Promise<boolean> {
    try {
      await this.request('put', `${ATA_UNIT_PATH}/${id}`, { data: values })
    } catch {
      return false
    }
    try {
      await this.syncRegistry()
    } catch (error) {
      this.logger.error('Failed to refresh registry after updateValues:', error)
    }
    return true
  }

  protected override async doAuthenticate({
    password,
    username,
  }: ClassicLoginCredentials): Promise<void> {
    this.#clearPersistedSession()
    const tokens = await performTokenAuth({
      credentials: { password, username },
      ...(this.abortSignal === undefined ?
        {}
      : { abortSignal: this.abortSignal }),
    })
    this.#storeTokens(tokens)
    ;({ password: this.password, username: this.username } = {
      password,
      username,
    })
  }

  /* ---------------------------------------------------------------- */
  /*  Private — credentials & session                                 */
  /* ---------------------------------------------------------------- */
  protected async ensureSession(): Promise<void> {
    if (!isSessionExpired(this.expiry)) {
      return
    }
    if (this.refreshToken !== '' && (await this.#refreshAccessToken())) {
      return
    }
    await this.authenticate()
  }

  protected getAuthHeaders(): Record<string, string> {
    return this.accessToken === '' ?
        {}
      : { Authorization: `Bearer ${this.accessToken}` }
  }

  protected async retryAuth<T>(
    method: string,
    url: string,
    config: Record<string, unknown>,
  ): Promise<HttpResponse<T> | null> {
    if (this.refreshToken !== '' && (await this.#refreshAccessToken())) {
      return this.dispatch<T>(method, url, config)
    }
    this.#clearPersistedSession()
    await this.authenticate()
    if (!this.isAuthenticated()) {
      return null
    }
    return this.dispatch<T>(method, url, config)
  }

  #clearPersistedSession(): void {
    this.#user = null
    this.accessToken = ''
    this.refreshToken = ''
    this.expiry = ''
  }

  /* ---------------------------------------------------------------- */
  /*  Private — token management                                      */
  /* ---------------------------------------------------------------- */
  /**
   * Fetch the user context from the BFF and update local state.
   * Shared by `getUser()` and `list()`.
   * @returns The fetched home context.
   */
  async #fetchContext(): Promise<HomeContext> {
    const { data } = await this.request('get', CONTEXT_PATH)
    const validated = parseOrThrow(HomeContextSchema, data, 'BFF /context')
    this.#syncContext(validated)
    return validated
  }

  #hasPersistedSession(): boolean {
    return (
      (this.accessToken !== '' &&
        this.expiry !== '' &&
        !isSessionExpired(this.expiry)) ||
      this.refreshToken !== ''
    )
  }

  /* ---------------------------------------------------------------- */
  /*  Private — API request pipeline                                  */
  /* ---------------------------------------------------------------- */
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

  async #safeRequest<T>({
    config,
    context,
    schema,
    url,
  }: {
    context: string
    schema: z.ZodType<T>
    url: string
    config?: Record<string, unknown>
  }): Promise<T | null> {
    try {
      const { data } = await this.request('get', url, config)
      return parseOrThrow(schema, data, context)
    } catch {
      return null
    }
  }

  #storeTokens({
    access_token: accessToken,
    expires_in: expiresIn,
    refresh_token: refreshToken,
  }: TokenResponse): void {
    this.accessToken = accessToken
    if (refreshToken !== undefined && refreshToken !== '') {
      this.refreshToken = refreshToken
    }
    this.expiry = new Date(
      Date.now() + expiresIn * MILLISECONDS_IN_SECOND,
    ).toISOString()
  }

  #syncContext(data: HomeContext): void {
    this.#context = data
    this.#user = parseUser(data)
  }
}
