import type {
  HomeAtaValues,
  HomeAtwValues,
  HomeBuilding,
  HomeContext,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
  HomeTokenResponse,
  HomeUser,
  HomeUserContext,
  LoginCredentials,
  Result,
} from '../types/index.ts'
import { type HomeAtwZoneMode, HomeDeviceType } from '../constants.ts'
import { fetchDevices, setting, syncDevices } from '../decorators/index.ts'
import {
  type TypedHomeDeviceData,
  HomeRegistry,
} from '../entities/home-registry.ts'
import { AuthenticationThrottledError } from '../errors/index.ts'
import { isHttpError } from '../http/index.ts'
import { isSessionExpired } from '../resilience/index.ts'
import { Temporal } from '../temporal.ts'
import { SESSION_REFRESH_AHEAD_MS } from '../time-units.ts'
import {
  HomeContextSchema,
  HomeEnergyDataSchema,
  HomeErrorLogEntryListSchema,
  HomeReportDataSchema,
  HomeResilientContextSchema,
  HomeUserContextSchema,
  parseOrThrow,
} from '../validation/index.ts'
import type { HomeAPIAdapter, HomeAPIConfig } from './home-types.ts'
import { BaseAPI, normalizeUnauthorized } from './base.ts'
import { performTokenAuth, refreshAccessToken } from './token-auth.ts'

const API_BASE_URL = 'https://mobile.bff.melcloudhome.com'
const ATA_UNIT_PATH = '/monitor/ataunit'
const HTTP_TOO_MANY_REQUESTS = 429
const ATW_UNIT_PATH = '/monitor/atwunit'

/**
 * Wire-facing ATW payload: zone modes lowered to the camelCase form the
 * PUT endpoint accepts.
 */
type HomeAtwWireValues = Omit<
  HomeAtwValues,
  'operationModeZone1' | 'operationModeZone2'
> & {
  readonly operationModeZone1?: string | null
  readonly operationModeZone2?: string | null
}

// The BFF reports zone modes in PascalCase but its PUT endpoint only
// accepts them in camelCase (a PascalCase value earns a bare 400) —
// live-probed against /monitor/atwunit.
const wireZoneModes: Record<HomeAtwZoneMode, string> = {
  curve: 'heatCurve',
  flow: 'heatFlowTemperature',
  flow_cool: 'coolFlowTemperature',
  room: 'heatRoomTemperature',
  room_cool: 'coolRoomTemperature',
}

// Only string values are lowered: an explicit null (clear) passes through
// untouched, and a present-but-undefined key (reachable from plain JS)
// keeps the absent-key semantics JSON serialization gives it.
// Plain-JS callers can bypass the union type; an unknown mode must fail
// loudly here rather than serialize as `undefined` and silently no-op.
const toWireZoneMode = (mode: HomeAtwZoneMode): string => {
  if (!Object.hasOwn(wireZoneModes, mode)) {
    throw new TypeError(`Unknown ATW zone mode: ${mode}`)
  }
  return wireZoneModes[mode]
}

const toAtwWireValues = (values: HomeAtwValues): HomeAtwWireValues => ({
  ...values,
  ...(typeof values.operationModeZone1 === 'string' && {
    operationModeZone1: toWireZoneMode(values.operationModeZone1),
  }),
  ...(typeof values.operationModeZone2 === 'string' && {
    operationModeZone2: toWireZoneMode(values.operationModeZone2),
  }),
})
const ATW_ENERGY_MEASURE = {
  consumed: 'interval_energy_consumed',
  produced: 'interval_energy_produced',
} as const

/**
 * Flatten a building's ATA + ATW units into typed registry entries,
 * tagging each with the caller-supplied ownership origin.
 * @param building - Source building from `/context`.
 * @param isOwner - `true` for a `buildings` entry, `false` for a guest one.
 * @returns Typed device entries ready for {@link HomeRegistry.sync}.
 */
const toTypedDevices = (
  building: HomeBuilding,
  isOwner: boolean,
): TypedHomeDeviceData[] => {
  const buildingRef = { id: building.id, name: building.name }
  return [
    ...building.airToAirUnits.map((device) => ({
      building: buildingRef,
      device,
      isOwner,
      type: HomeDeviceType.Ata,
    })),
    ...building.airToWaterUnits.map((device) => ({
      building: buildingRef,
      device,
      isOwner,
      type: HomeDeviceType.Atw,
    })),
  ]
}
const DEFAULT_RATE_LIMIT_FALLBACK_HOURS = 2
const DEFAULT_SYNC_INTERVAL_MINUTES = 1

const parseUser = (data: HomeUserContext): HomeUser => ({
  email: data.email,
  firstName: data.firstname,
  lastName: data.lastname,
  sub: data.id,
})

// Anchor on UTC so the host's local timezone cannot shift the
// formatted output: `offset: 'use'` keeps offset-bearing inputs
// (e.g. `'2026-03-01T10:00:00Z'`) at their absolute instant while
// offset-less inputs (e.g. `'2026-03-01'`) adopt UTC wall time.
const parseUTCPlainDateTime = (iso: string): Temporal.PlainDateTime =>
  Temporal.ZonedDateTime.from(`${iso}[UTC]`, {
    offset: 'use',
  }).toPlainDateTime()

// `/report/v1/trendsummary` expects .NET-style ISO with 7 subsecond zeros
// (e.g. `2026-04-19T00:00:00.0000000`). Anything shorter is silently
// truncated to an empty window by the BFF.
const toReportDate = (iso: string): string =>
  parseUTCPlainDateTime(iso)
    .round({ roundingMode: 'trunc', smallestUnit: 'second' })
    .toString({ fractionalSecondDigits: 7 })

// `/telemetry/telemetry/{energy,actual}` expect `YYYY-MM-DD HH:MM` with a
// space and no seconds. Seconds or an ISO `T` separator produce an empty
// payload rather than an error.
const toTelemetryDate = (iso: string): string =>
  parseUTCPlainDateTime(iso)
    .toString({ smallestUnit: 'minute' })
    .replace('T', ' ')

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
export class HomeAPI extends BaseAPI implements HomeAPIAdapter {
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
   * BCP-47 locale supplied via {@link HomeAPIConfig.locale}, or
   * `undefined` to fall back to the runtime locale. Drives chart label
   * formatting in the device facades.
   * @returns The configured BCP-47 locale tag, or `undefined`.
   */
  public get locale(): string | undefined {
    return this.#locale
  }

  /**
   * In-memory device registry populated by {@link list}.
   * @returns The registry instance.
   */
  public get registry(): HomeRegistry {
    return this.#registry
  }

  /**
   * IANA timezone supplied via {@link HomeAPIConfig.timezone},
   * or `undefined` to fall back to UTC. The Home wire itself speaks
   * UTC wall-clock; this timezone only anchors chart windows and
   * label rendering in the device facades.
   * @returns The configured IANA timezone identifier, or `undefined`.
   */
  public get timezone(): string | undefined {
    return this.#timezone
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

  readonly #locale: string | undefined

  readonly #registry = new HomeRegistry()

  readonly #timezone: string | undefined

  #user: HomeUser | null = null

  @setting
  private accessor accessToken = ''

  @setting
  private accessor refreshToken = ''

  private constructor(config: HomeAPIConfig = {}) {
    const {
      baseURL = API_BASE_URL,
      locale,
      password,
      timezone,
      username,
    } = config
    super(config, {
      defaultSyncIntervalMinutes: DEFAULT_SYNC_INTERVAL_MINUTES,
      httpConfig: { baseURL },
      rateLimitHours: DEFAULT_RATE_LIMIT_FALLBACK_HOURS,
      syncCallback: async () => this.list(),
    })
    this.#locale = locale
    this.#timezone = timezone
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
    await api.start(config?.shouldResumeSessionInBackground === true)
    return api
  }

  /**
   * Fetch all buildings (owned + guest), sync the device registry,
   * and schedule the next auto-sync.
   * @returns All buildings or an empty array on failure.
   */
  @syncDevices()
  public async list(): Promise<HomeBuilding[]> {
    return this.runSyncCycle(async () => {
      const data = await this.#fetchContext()
      this.#registry.sync([
        // Guest entries first: the registry upsert is last-write-wins
        // per id, so a device duplicated across `buildings` and
        // `guestBuildings` keeps its owned tag.
        ...data.guestBuildings.flatMap((building) =>
          toTypedDevices(building, false),
        ),
        ...data.buildings.flatMap((building) => toTypedDevices(building, true)),
      ])
      return [...data.buildings, ...data.guestBuildings]
    })
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
  public async getAtaEnergy(
    id: string,
    params: { from: string; interval: string; to: string },
  ): Promise<Result<HomeEnergyData>> {
    return this.#fetchEnergy(id, {
      ...params,
      measure: 'cumulative_energy_consumed_since_last_upload',
    })
  }

  /**
   * Fetch the error-log entries for an ATA unit. Same {@link Result}
   * contract as {@link getAtaEnergy}.
   * @param id - Device id.
   * @returns Success with the entries (possibly empty), or a typed failure.
   */
  public async getAtaErrorLog(
    id: string,
  ): Promise<Result<HomeErrorLogEntry[]>> {
    return this.#fetchErrorLog(ATA_UNIT_PATH, id)
  }

  /**
   * Fetch a trend-summary report (temperatures, etc.) for an ATA
   * unit. Same {@link Result} contract as {@link getAtaEnergy}.
   * @param id - Device id.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.period - Aggregation period (e.g. `hour`, `day`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns Success with the report datasets, or a typed failure.
   */
  public async getAtaTemperatures(
    id: string,
    params: { from: string; period: string; to: string },
  ): Promise<Result<HomeReportData[]>> {
    return this.#fetchReport('/report/v1/trendsummary', id, params)
  }

  /**
   * Fetch interval-energy telemetry for an ATW unit. Unlike ATA's
   * `cumulative_energy_consumed_since_last_upload`, ATW exposes
   * separate `interval_energy_consumed` and `interval_energy_produced`
   * measures (kWh per bucket, not cumulative — live-probed 2026-07-17).
   * @param id - Device id.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.interval - Aggregation interval (`Minute`, `Hour`, `Day`, `Week` or `Month`).
   * @param params.measure - Energy direction (`'consumed'` or `'produced'`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns Success with the telemetry bundle, or a typed failure.
   */
  public async getAtwEnergy(
    id: string,
    params: {
      from: string
      interval: string
      measure: 'consumed' | 'produced'
      to: string
    },
  ): Promise<Result<HomeEnergyData>> {
    return this.#fetchEnergy(id, {
      ...params,
      measure: ATW_ENERGY_MEASURE[params.measure],
    })
  }

  /**
   * Fetch the error-log entries for an ATW unit. Mirror of {@link getAtaErrorLog}.
   * @param id - Device id.
   * @returns Success with the entries (possibly empty), or a typed failure.
   */
  public async getAtwErrorLog(
    id: string,
  ): Promise<Result<HomeErrorLogEntry[]>> {
    return this.#fetchErrorLog(ATW_UNIT_PATH, id)
  }

  /**
   * Fetch the internal-temperatures report (flow/return/tank/zone)
   * for an ATW unit. Same {@link Result} contract as {@link getAtaEnergy}.
   * @param id - Device id.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.period - Aggregation period (e.g. `Daily`, `Hourly`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns Success with the report datasets, or a typed failure.
   */
  public async getAtwInternalTemperatures(
    id: string,
    params: { from: string; period: string; to: string },
  ): Promise<Result<HomeReportData[]>> {
    return this.#fetchReport('/report/v1/internaltemperatures', id, params)
  }

  /**
   * Fetch the comfort-graph report (outside / room / set temperature)
   * for an ATW unit. Same {@link Result} contract as {@link getAtaEnergy}.
   * @param id - Device id.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.period - Aggregation period (e.g. `Daily`, `Hourly`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns Success with the report datasets, or a typed failure.
   */
  public async getAtwTemperatures(
    id: string,
    params: { from: string; period: string; to: string },
  ): Promise<Result<HomeReportData[]>> {
    return this.#fetchReport('/report/v1/comfort-graph', id, params)
  }

  /**
   * Fetch RSSI telemetry for a device (ATA or ATW). Same {@link Result}
   * contract as {@link getAtaEnergy}.
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
   * Refresh the user by fetching the `/context` identity. On failure
   * the last known user is returned unchanged: transient failures and
   * device-payload drift must not read as "logged out" — the
   * reactive-401 path (`reauthenticate()`) is the single owner of
   * clearing the authentication state, so a definitive rejection has
   * already nulled the user by the time the failure surfaces here.
   * @returns The user or `null`.
   */
  public async getUser(): Promise<HomeUser | null> {
    try {
      await this.#fetchContext()
    } catch {
      // Deliberately swallowed: the request pipeline logged the
      // failure and a real 401 has cleared the user state already.
    }
    return this.#user
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
   * the typed transport error propagates and the sync is skipped — the
   * server state is presumed unchanged, so a re-fetch would be wasted
   * work. The mutation + post-sync orchestration lives in
   * `#putAtaAndSync`, where `@fetchDevices({ when: 'after' })` applies
   * the same post-mutation-refresh contract as Classic facades — just
   * resolved via `syncRegistry()` instead of `api.fetch()`.
   * @param id - Target device id.
   * @param values - Partial setpoint payload.
   */
  public async updateAtaValues(
    id: string,
    values: HomeAtaValues,
  ): Promise<void> {
    await this.putAtaAndSync(id, values)
  }

  /**
   * Send an ATW-unit setpoint update to the BFF. Mirror of
   * {@link updateAtaValues} for air-to-water heat pumps; same
   * post-mutation-refresh semantics.
   * @param id - Target device id.
   * @param values - Partial setpoint payload.
   */
  public async updateAtwValues(
    id: string,
    values: HomeAtwValues,
  ): Promise<void> {
    await this.putAtwAndSync(id, values)
  }

  protected override clearPersistedSession(): void {
    this.#user = null
    this.accessToken = ''
    this.refreshToken = ''
    this.expiry = ''
  }

  protected override async doAuthenticate({
    password,
    username,
  }: LoginCredentials): Promise<void> {
    const request = {
      credentials: { password, username },
      ...(this.abortSignal !== undefined && {
        abortSignal: this.abortSignal,
      }),
    }
    try {
      await this.#exchangeAndStoreTokens(request)
    } catch (error) {
      // Normalize transport-level `401 Unauthorized` from the BFF
      // into the shared {@link AuthenticationError} domain type so
      // callers of `authenticate()` get a stable error shape (mirror
      // of the Classic `LoginData: null → AuthenticationError` path).
      // Cognito refusals arrive already classified from token-auth;
      // the remaining non-401 errors (PAR failures, network timeouts)
      // propagate unchanged.
      if (
        isHttpError(error) &&
        error.response.status === HTTP_TOO_MANY_REQUESTS
      ) {
        // The BFF/Cognito login throttle — the Home mirror of Classic's
        // ErrorId 6. Valid credentials, blocked endpoint: back off.
        throw new AuthenticationThrottledError(
          'MELCloud Home is temporarily blocking sign-ins (too many attempts)',
        )
      }
      const authError = normalizeUnauthorized(error)
      if (authError !== null) {
        throw authError
      }
      throw error
    }
    this.applyCredentials(username, password)
  }

  protected getAuthHeaders(): Record<string, string> {
    return this.accessToken === '' ?
        {}
      : { Authorization: `Bearer ${this.accessToken}` }
  }

  protected override hasPersistedSession(): boolean {
    return (
      (this.accessToken !== '' &&
        this.expiry !== '' &&
        !isSessionExpired(this.expiry)) ||
      this.refreshToken !== ''
    )
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
    this.clearPersistedSession()
    return this.resumeSession()
  }

  /**
   * The base probe's `syncRegistry()` runs `list()`, which hits
   * `/context` once and hydrates `context`/`user` AND the device
   * registry in a single request; an expired token triggers the
   * pipeline's 401-retry + refresh-token flow along the way. Success
   * requires a parsed context on top of the identity: a `true` reuse
   * promises a verified registry, so an identity-only round-trip
   * (the salvage parse failed) must fall through to the full-auth
   * path instead of claiming the reuse completed.
   * @returns `true` when persisted tokens verified against the BFF.
   */
  protected override reuseSucceeded(): boolean {
    return this.isAuthenticated() && this.context !== null
  }

  protected override async syncRegistry(): Promise<void> {
    await this.list()
  }

  /**
   * Core of {@link updateAtaValues}: perform the PUT and, on success,
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
  private async putAtaAndSync(
    id: string,
    values: HomeAtaValues,
  ): Promise<void> {
    await this.#putDeviceValues(ATA_UNIT_PATH, id, values)
  }

  /**
   * ATW counterpart to {@link putAtaAndSync}. Same post-mutation-refresh
   * contract; only the URL prefix and payload type differ.
   * @param id - Target device id.
   * @param values - Partial setpoint payload.
   */
  @fetchDevices({ when: 'after' })
  private async putAtwAndSync(
    id: string,
    values: HomeAtwValues,
  ): Promise<void> {
    await this.#putDeviceValues(ATW_UNIT_PATH, id, toAtwWireValues(values))
  }

  async #exchangeAndStoreTokens(
    request: Parameters<typeof performTokenAuth>[0],
  ): Promise<void> {
    const tokens = await performTokenAuth(request)
    this.#storeTokens(tokens)
  }

  /**
   * Fetch the user context from the BFF and update local state.
   * Shared by `getUser()` and `list()`.
   *
   * Two-stage parse: the identity slice is validated first, so any
   * successful `/context` round-trip marks the session authenticated —
   * device-payload drift must degrade the registry, never the
   * authentication state (a strict-only parse used to read as
   * "unauthenticated" and re-open the settings login form). The full
   * payload is then parsed strictly; on drift the failure is logged
   * with its field paths and the salvage schema recovers everything
   * that still validates per unit.
   * @returns The fetched home context.
   */
  async #fetchContext(): Promise<HomeContext> {
    const raw = await this.requestData('get', '/context')
    this.#user = parseUser(
      parseOrThrow(HomeUserContextSchema, raw, 'GET /context'),
    )
    const strict = HomeContextSchema.safeParse(raw)
    if (!strict.success) {
      this.logger.error(
        'Home context drifted from the strict schema; salvaging device entries:',
        strict.error,
      )
    }
    const data =
      strict.success ?
        strict.data
      : parseOrThrow(HomeResilientContextSchema, raw, 'GET /context (salvage)')
    this.#context = data
    return data
  }

  /**
   * Issue an energy-telemetry GET to the BFF. The two public energy
   * variants (ATA cumulative, ATW interval consumed/produced) only
   * differ in their `measure` query parameter; this helper centralises
   * the URL, date-format normalisation, and schema binding.
   * @param id - Device id.
   * @param params - Query window plus the resolved BFF measure name.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.interval - Aggregation interval (e.g. `Hour`, `Day`).
   * @param params.measure - Resolved BFF measure name (e.g. `interval_energy_consumed`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns Success with the telemetry bundle, or a typed failure.
   */
  async #fetchEnergy(
    id: string,
    params: { from: string; interval: string; measure: string; to: string },
  ): Promise<Result<HomeEnergyData>> {
    return this.safeRequest('get', `/telemetry/telemetry/energy/${id}`, {
      params: {
        from: toTelemetryDate(params.from),
        interval: params.interval,
        measure: params.measure,
        to: toTelemetryDate(params.to),
      },
      schema: HomeEnergyDataSchema,
    })
  }

  /**
   * Issue an error-log GET against either the ATA or ATW unit path.
   * Both endpoints share the response schema; only the URL prefix
   * differs.
   * @param unitPath - URL prefix (`/monitor/ataunit` or `/monitor/atwunit`).
   * @param id - Device id.
   * @returns Success with the entries (possibly empty), or a typed failure.
   */
  async #fetchErrorLog(
    unitPath: string,
    id: string,
  ): Promise<Result<HomeErrorLogEntry[]>> {
    return this.safeRequest('get', `${unitPath}/${id}/errorlog`, {
      schema: HomeErrorLogEntryListSchema,
    })
  }

  /**
   * Issue a report GET (`trendsummary`, `comfort-graph`, or
   * `internaltemperatures`) — all three endpoints accept the same
   * `unitId` + `from`/`period`/`to` query shape and return the same
   * dataset envelope.
   * @param path - Report endpoint URL.
   * @param id - Device id (sent as `unitId`).
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.period - Aggregation period (e.g. `Daily`, `Hourly`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns Success with the report datasets, or a typed failure.
   */
  async #fetchReport(
    path: string,
    id: string,
    params: { from: string; period: string; to: string },
  ): Promise<Result<HomeReportData[]>> {
    return this.safeRequest('get', path, {
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
   * Issue a device-values PUT. Centralises the URL shape (`{unitPath}/{id}`)
   * shared by the ATA and ATW mutation paths.
   * @param unitPath - URL prefix (`/monitor/ataunit` or `/monitor/atwunit`).
   * @param id - Target device id.
   * @param values - Partial setpoint payload.
   */
  async #putDeviceValues(
    unitPath: string,
    id: string,
    values: HomeAtaValues | HomeAtwWireValues,
  ): Promise<void> {
    await this.request('put', `${unitPath}/${id}`, { data: values })
  }

  /**
   * Use the refresh token to obtain a fresh access token.
   * @returns Whether the refresh succeeded.
   */
  async #refreshAccessToken(): Promise<boolean> {
    const tokens = await refreshAccessToken({
      logger: this.logger,
      refreshToken: this.refreshToken,
      ...(this.abortSignal !== undefined && { abortSignal: this.abortSignal }),
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
    this.expiry = Temporal.Now.instant().add({ seconds: expiresIn }).toString()
  }
}
