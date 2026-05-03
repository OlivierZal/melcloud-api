import { DateTime } from 'luxon'

import type {
  HomeAtaValues,
  HomeBuilding,
  HomeContext,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
  HomeTokenResponse,
  HomeUser,
  LoginCredentials,
  Result,
} from '../types/index.ts'
import { HomeDeviceType } from '../constants.ts'
import { fetchDevices, setting, syncDevices } from '../decorators/index.ts'
import { HomeRegistry } from '../entities/home-registry.ts'
import { isSessionExpired } from '../resilience/index.ts'
import { MS_PER_SECOND, SESSION_REFRESH_AHEAD_MS } from '../time-units.ts'
import {
  HomeContextSchema,
  HomeEnergyDataSchema,
  HomeErrorLogEntryListSchema,
  HomeReportDataSchema,
} from '../validation/index.ts'
import type { HomeAPIConfig, HomeAPI as HomeAPIContract } from './home-types.ts'
import { BaseAPI, normalizeUnauthorized } from './base.ts'
import { performTokenAuth, refreshAccessToken } from './token-auth.ts'

const API_BASE_URL = 'https://mobile.bff.melcloudhome.com'
const ATA_UNIT_PATH = '/monitor/ataunit'
const DEFAULT_RATE_LIMIT_FALLBACK_HOURS = 2
const DEFAULT_SYNC_INTERVAL_MINUTES = 1

const parseUser = (data: HomeContext): HomeUser => ({
  email: data.email,
  firstName: data.firstname,
  lastName: data.lastname,
  sub: data.id,
})

// `/report/v1/trendsummary` expects .NET-style ISO with 7 subsecond zeros
// (e.g. `2026-04-19T00:00:00.0000000`). Anything shorter is silently
// truncated to an empty window by the BFF.
//
// Parse with `{ zone: 'utc' }` so offset-less inputs (e.g. `'2026-03-01'`)
// are read as UTC rather than being re-interpreted through the host's
// local timezone — otherwise the formatted output drifts by the host's
// current offset.
const toReportDate = (iso: string): string =>
  DateTime.fromISO(iso, { zone: 'utc' }).toFormat(
    "yyyy-MM-dd'T'HH:mm:ss'.0000000'",
  )

// `/telemetry/telemetry/{energy,actual}` expect `YYYY-MM-DD HH:MM` with a
// space and no seconds. Seconds or an ISO `T` separator produce an empty
// payload rather than an error. Same UTC-parse rationale as
// {@link toReportDate}.
const toTelemetryDate = (iso: string): string =>
  DateTime.fromISO(iso, { zone: 'utc' }).toFormat('yyyy-MM-dd HH:mm')

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
 * @category API Clients
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
    const { baseURL = API_BASE_URL, password, username } = config
    super(config, {
      defaultSyncIntervalMinutes: DEFAULT_SYNC_INTERVAL_MINUTES,
      httpConfig: { baseURL },
      rateLimitHours: DEFAULT_RATE_LIMIT_FALLBACK_HOURS,
      syncCallback: async () => this.list(),
    })
    this.applyCredentials(username, password)
  }

  /**
   * Create and initialize a MELCloud Home API instance.
   *
   * Delegates post-construction setup to {@link BaseAPI.initialize}
   * so the #1281-class invariant is enforced uniformly: the reuse
   * path, the fresh-auth path, and the "no credentials" path all go
   * through the same template and cannot leave the registry empty
   * while claiming success.
   * @param config - Optional configuration.
   * @returns The initialized HomeAPI instance.
   */
  public static async create(config?: HomeAPIConfig): Promise<HomeAPI> {
    const api = new HomeAPI(config)
    await api.initialize()
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
   * Fetch cumulative-energy telemetry for an ATA unit. Returns a
   * {@link Result} so callers can branch on the failure class
   * (`validation` for shape drift, `server` for 4xx/5xx,
   * `unauthorized` for token rejection, `rate-limited`, `network`).
   * @param id - Device id.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.interval - Aggregation interval (e.g. `PT1H`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns Success with the telemetry bundle, or a typed failure.
   */
  public async getEnergy(
    id: string,
    params: { from: string; interval: string; to: string },
  ): Promise<Result<HomeEnergyData>> {
    return this.safeRequest('get', `/telemetry/telemetry/energy/${id}`, {
      params: {
        from: toTelemetryDate(params.from),
        interval: params.interval,
        measure: 'cumulative_energy_consumed_since_last_upload',
        to: toTelemetryDate(params.to),
      },
      schema: HomeEnergyDataSchema,
    })
  }

  /**
   * Fetch the error-log entries for an ATA unit. Same {@link Result}
   * contract as {@link getEnergy}.
   * @param id - Device id.
   * @returns Success with the entries (possibly empty), or a typed failure.
   */
  public async getErrorLog(id: string): Promise<Result<HomeErrorLogEntry[]>> {
    return this.safeRequest('get', `${ATA_UNIT_PATH}/${id}/errorlog`, {
      schema: HomeErrorLogEntryListSchema,
    })
  }

  /**
   * Fetch RSSI telemetry for an ATA unit. Same {@link Result}
   * contract as {@link getEnergy}.
   * @param id - Device id.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns Success with the telemetry bundle, or a typed failure.
   */
  public async getSignal(
    id: string,
    params: { from: string; to: string },
  ): Promise<Result<HomeEnergyData>> {
    return this.safeRequest('get', `/telemetry/telemetry/actual/${id}`, {
      params: {
        from: toTelemetryDate(params.from),
        measure: 'rssi',
        to: toTelemetryDate(params.to),
      },
      schema: HomeEnergyDataSchema,
    })
  }

  /**
   * Fetch a trend-summary report (temperatures, etc.) for an ATA
   * unit. Same {@link Result} contract as {@link getEnergy}.
   * @param id - Device id.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.period - Aggregation period (e.g. `hour`, `day`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns Success with the report datasets, or a typed failure.
   */
  public async getTemperatures(
    id: string,
    params: { from: string; period: string; to: string },
  ): Promise<Result<HomeReportData[]>> {
    return this.safeRequest('get', '/report/v1/trendsummary', {
      params: {
        from: toReportDate(params.from),
        period: params.period,
        to: toReportDate(params.to),
        unitId: id,
      },
      schema: HomeReportDataSchema.array(),
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

  /**
   * Whether the BFF `/context` call has resolved a user identity.
   * @returns `true` once authenticated.
   */
  public isAuthenticated(): boolean {
    return this.#user !== null
  }

  /**
   * Send an ATA-unit setpoint update to the BFF. On success, re-sync
   * the registry so it reflects the server-side effect of the write
   * (the PUT response itself does not echo device fields). On failure,
   * skip the sync — the server state is presumed unchanged, so a
   * re-fetch would be wasted work.
   *
   * Boolean surface is preserved for integrating hosts (e.g. Homey
   * drivers) that treat transient failures as a no-op and retry on
   * the next sync. The actual mutation + post-sync orchestration
   * lives in `#putAndSync`, where `@fetchDevices({ when: 'after' })`
   * applies the same post-mutation-refresh contract as Classic
   * facades — just resolved via `syncRegistry()` instead of
   * `api.fetch()`.
   * @param id - Target device id.
   * @param values - Partial setpoint payload.
   * @returns `true` when the update succeeded, `false` otherwise.
   */
  public async updateValues(
    id: string,
    values: HomeAtaValues,
  ): Promise<boolean> {
    try {
      await this.putAndSync(id, values)
      return true
    } catch {
      return false
    }
  }

  protected override async doAuthenticate({
    password,
    username,
  }: LoginCredentials): Promise<void> {
    this.#clearPersistedSession()
    try {
      const tokens = await performTokenAuth({
        credentials: { password, username },
        ...(this.abortSignal === undefined ?
          {}
        : { abortSignal: this.abortSignal }),
      })
      this.#storeTokens(tokens)
    } catch (error) {
      // Normalize transport-level `401 Unauthorized` from the BFF
      // into the shared {@link AuthenticationError} domain type so
      // callers of `authenticate()` get a stable error shape (mirror
      // of the Classic `LoginData: null → AuthenticationError` path).
      // Non-401 errors (PAR failures, Cognito redirect chain issues,
      // network timeouts) propagate unchanged.
      throw normalizeUnauthorized(error)
    }
    ;({ password: this.password, username: this.username } = {
      password,
      username,
    })
  }

  protected getAuthHeaders(): Record<string, string> {
    return this.accessToken === '' ?
        {}
      : { Authorization: `Bearer ${this.accessToken}` }
  }

  /**
   * Home considers a session in need of refresh when the access
   * token is within {@link SESSION_REFRESH_AHEAD_MS} of its real
   * expiry. The forward window lets the shared `BaseAPI.ensureSession`
   * template renew the token pre-emptively via
   * {@link performSessionRefresh}, keeping the OIDC round-trip off
   * the request's critical path.
   * @returns `true` when a refresh should run before the next request.
   */
  protected override needsSessionRefresh(): boolean {
    return isSessionExpired(this.expiry, SESSION_REFRESH_AHEAD_MS)
  }

  /**
   * Home session refresh = try the cheap refresh-token exchange
   * first; if the refresh token is rejected (or missing), fall
   * through to a full {@link resumeSession} (re-auth from persisted
   * username/password). `resumeSession` logs + swallows on failure;
   * the 401 retry path on the triggering request handles hard errors.
   */
  protected override async performSessionRefresh(): Promise<void> {
    if (this.refreshToken !== '' && (await this.#refreshAccessToken())) {
      return
    }
    await this.resumeSession()
  }

  /**
   * Reactive-401 refresh for Home. The access token was just
   * rejected, so we clear it before trying recovery: first the
   * cheap refresh-token exchange, then a full {@link resumeSession}
   * as fallback. The shared {@link AuthRetryPolicy} replays the
   * original request on success.
   * @returns `true` when the instance is authenticated afterwards.
   */
  protected override async reauthenticate(): Promise<boolean> {
    if (this.refreshToken !== '' && (await this.#refreshAccessToken())) {
      return true
    }
    this.#clearPersistedSession()
    return this.resumeSession()
  }

  protected override async syncRegistry(): Promise<void> {
    await this.list()
  }

  /**
   * Reuse a persisted Home session by issuing the standard
   * `list()` call, which hits `/context` once and hydrates both
   * `context`/`user` AND the device registry in a single request.
   * A valid token returns populated context; an expired one triggers
   * the request pipeline's 401-retry + refresh-token flow; anything
   * else falls through to a full authenticate.
   * @returns `true` when persisted tokens verified against the BFF
   * (registry populated via the same round-trip); `false` otherwise.
   */
  protected override async tryReuseSession(): Promise<boolean> {
    if (!this.#hasPersistedSession()) {
      return false
    }
    await this.list()
    if (this.context !== null) {
      return true
    }
    this.#clearPersistedSession()
    return false
  }

  /**
   * Core of {@link updateValues}: perform the PUT and, on success,
   * trigger a post-mutation registry refresh via
   * `@fetchDevices({ when: 'after' })`. Throws on PUT failure so the
   * decorator skips the sync (failed mutation → server state
   * unchanged → re-fetch wasted). Sync failures after a successful
   * PUT are logged and swallowed by the decorator itself, preserving
   * the "mutation landed" truth even when the post-refresh flakes.
   * @param id - Target device id.
   * @param values - Partial setpoint payload.
   */
  @fetchDevices({ when: 'after' })
  private async putAndSync(id: string, values: HomeAtaValues): Promise<void> {
    await this.request('put', `${ATA_UNIT_PATH}/${id}`, { data: values })
  }

  #clearPersistedSession(): void {
    this.#user = null
    this.accessToken = ''
    this.refreshToken = ''
    this.expiry = ''
  }

  /**
   * Fetch the user context from the BFF and update local state.
   * Shared by `getUser()` and `list()`.
   * @returns The fetched home context.
   */
  async #fetchContext(): Promise<HomeContext> {
    const data = await this.requestData('get', '/context', {
      schema: HomeContextSchema,
    })
    this.#syncContext(data)
    return data
  }

  #hasPersistedSession(): boolean {
    return (
      (this.accessToken !== '' &&
        this.expiry !== '' &&
        !isSessionExpired(this.expiry)) ||
      this.refreshToken !== ''
    )
  }

  /**
   * Use the refresh token to obtain a fresh access token.
   * @returns Whether the refresh succeeded.
   */
  async #refreshAccessToken(): Promise<boolean> {
    const tokens = await refreshAccessToken({
      logger: this.logger,
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

  #storeTokens({
    access_token: accessToken,
    expires_in: expiresIn,
    refresh_token: refreshToken,
  }: HomeTokenResponse): void {
    this.accessToken = accessToken
    if (refreshToken !== undefined && refreshToken !== '') {
      this.refreshToken = refreshToken
    }
    this.expiry = new Date(Date.now() + expiresIn * MS_PER_SECOND).toISOString()
  }

  #syncContext(data: HomeContext): void {
    this.#context = data
    this.#user = parseUser(data)
  }
}
